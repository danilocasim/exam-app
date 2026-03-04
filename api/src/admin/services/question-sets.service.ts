import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionStatus } from '@prisma/client';
import type { QuestionSetResponseDto } from '../dto/question-set.dto';

@Injectable()
export class QuestionSetsService {
  private readonly logger = new Logger(QuestionSetsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private toDto(
    s: {
      id: string;
      examTypeId: string;
      name: string;
      slug: string;
      description: string | null;
      isSystem: boolean;
      archivedAt: Date | null;
      createdAt: Date;
    },
    questionCount: number,
  ): QuestionSetResponseDto {
    return {
      id: s.id,
      examTypeId: s.examTypeId,
      name: s.name,
      slug: s.slug,
      description: s.description,
      isSystem: s.isSystem,
      archivedAt: s.archivedAt?.toISOString() ?? null,
      questionCount,
      createdAt: s.createdAt.toISOString(),
    };
  }

  private async getCountMap(examTypeId: string): Promise<Map<string, number>> {
    const counts = await this.prisma.question.groupBy({
      by: ['set'],
      where: {
        examTypeId,
        status: QuestionStatus.APPROVED,
        set: { not: null },
      },
      _count: { id: true },
    });
    const map = new Map<string, number>();
    for (const c of counts) {
      if (c.set) map.set(c.set, c._count.id);
    }
    return map;
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  /**
   * List all question sets for an exam type.
   * By default hides archived sets unless includeArchived is true.
   */
  async findAll(
    examTypeId: string,
    includeArchived = false,
  ): Promise<QuestionSetResponseDto[]> {
    await this.ensureExamTypeExists(examTypeId);

    const where: Record<string, unknown> = { examTypeId };
    if (!includeArchived) {
      where.archivedAt = null;
    }

    const sets = await this.prisma.questionSet.findMany({
      where,
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });

    const countMap = await this.getCountMap(examTypeId);

    return sets.map((s) => this.toDto(s, countMap.get(s.slug) ?? 0));
  }

  /**
   * Find a single question set by ID.
   */
  async findOne(id: string): Promise<QuestionSetResponseDto> {
    const set = await this.prisma.questionSet.findUnique({ where: { id } });
    if (!set) {
      throw new NotFoundException(`QuestionSet '${id}' not found`);
    }

    const count = await this.prisma.question.count({
      where: {
        examTypeId: set.examTypeId,
        set: set.slug,
        status: QuestionStatus.APPROVED,
      },
    });

    return this.toDto(set, count);
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  /**
   * Create a new question set for an exam type.
   */
  async create(
    examTypeId: string,
    name: string,
    slug: string,
    description?: string,
  ): Promise<QuestionSetResponseDto> {
    await this.ensureExamTypeExists(examTypeId);

    const existing = await this.prisma.questionSet.findUnique({
      where: { examTypeId_slug: { examTypeId, slug } },
    });
    if (existing) {
      throw new ConflictException(
        `QuestionSet with slug '${slug}' already exists for exam type '${examTypeId}'`,
      );
    }

    const set = await this.prisma.questionSet.create({
      data: { examTypeId, name, slug, description },
    });

    this.logger.log(
      `Created QuestionSet '${slug}' for exam type '${examTypeId}'`,
    );

    return this.toDto(set, 0);
  }

  /**
   * Update a question set (name, slug, description).
   * System sets allow name/description edits but not slug changes.
   * When slug changes, all associated questions are updated in a transaction.
   */
  async update(
    id: string,
    data: { name?: string; slug?: string; description?: string },
  ): Promise<QuestionSetResponseDto> {
    const existing = await this.prisma.questionSet.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`QuestionSet '${id}' not found`);
    }

    const slugChanging = data.slug && data.slug !== existing.slug;

    if (slugChanging && existing.isSystem) {
      throw new BadRequestException(
        `Cannot change slug of system set '${existing.slug}'`,
      );
    }

    if (slugChanging) {
      const conflict = await this.prisma.questionSet.findUnique({
        where: {
          examTypeId_slug: {
            examTypeId: existing.examTypeId,
            slug: data.slug!,
          },
        },
      });
      if (conflict && !conflict.archivedAt) {
        throw new ConflictException(
          `Slug '${data.slug}' already exists for this exam type`,
        );
      }
    }

    // Use transaction when slug changes to keep questions in sync
    if (slugChanging) {
      const [updated] = await this.prisma.$transaction([
        this.prisma.questionSet.update({ where: { id }, data }),
        this.prisma.question.updateMany({
          where: { examTypeId: existing.examTypeId, set: existing.slug },
          data: { set: data.slug! },
        }),
      ]);

      this.logger.log(
        `Updated set '${existing.slug}' → '${data.slug}' and cascaded to questions`,
      );

      const count = await this.prisma.question.count({
        where: {
          examTypeId: updated.examTypeId,
          set: updated.slug,
          status: QuestionStatus.APPROVED,
        },
      });
      return this.toDto(updated, count);
    }

    const updated = await this.prisma.questionSet.update({
      where: { id },
      data,
    });

    const count = await this.prisma.question.count({
      where: {
        examTypeId: updated.examTypeId,
        set: updated.slug,
        status: QuestionStatus.APPROVED,
      },
    });

    return this.toDto(updated, count);
  }

  /**
   * Archive a question set (soft delete).
   * System sets cannot be archived.
   */
  async archive(id: string): Promise<QuestionSetResponseDto> {
    const existing = await this.prisma.questionSet.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`QuestionSet '${id}' not found`);
    }
    if (existing.isSystem) {
      throw new BadRequestException(
        `Cannot archive system set '${existing.slug}'. System sets are required for core functionality.`,
      );
    }
    if (existing.archivedAt) {
      throw new BadRequestException(
        `QuestionSet '${existing.slug}' is already archived.`,
      );
    }

    const updated = await this.prisma.questionSet.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    this.logger.log(`Archived QuestionSet '${existing.slug}' (${id})`);

    const count = await this.prisma.question.count({
      where: {
        examTypeId: updated.examTypeId,
        set: updated.slug,
        status: QuestionStatus.APPROVED,
      },
    });

    return this.toDto(updated, count);
  }

  /**
   * Unarchive (restore) a question set.
   */
  async unarchive(id: string): Promise<QuestionSetResponseDto> {
    const existing = await this.prisma.questionSet.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`QuestionSet '${id}' not found`);
    }
    if (!existing.archivedAt) {
      throw new BadRequestException(
        `QuestionSet '${existing.slug}' is not archived.`,
      );
    }

    const updated = await this.prisma.questionSet.update({
      where: { id },
      data: { archivedAt: null },
    });

    this.logger.log(`Unarchived QuestionSet '${existing.slug}' (${id})`);

    const count = await this.prisma.question.count({
      where: {
        examTypeId: updated.examTypeId,
        set: updated.slug,
        status: QuestionStatus.APPROVED,
      },
    });

    return this.toDto(updated, count);
  }

  // ── Validation ───────────────────────────────────────────────────────────

  /**
   * Validate that a set slug exists (and is not archived) for a given exam type.
   */
  async slugExists(examTypeId: string, slug: string): Promise<boolean> {
    const set = await this.prisma.questionSet.findUnique({
      where: { examTypeId_slug: { examTypeId, slug } },
    });
    return !!set && !set.archivedAt;
  }

  private async ensureExamTypeExists(examTypeId: string): Promise<void> {
    const examType = await this.prisma.examType.findUnique({
      where: { id: examTypeId },
    });
    if (!examType) {
      throw new NotFoundException(`Exam type '${examTypeId}' not found`);
    }
  }
}

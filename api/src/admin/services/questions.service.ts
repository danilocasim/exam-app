import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QuestionStatus,
  QuestionType,
  Difficulty,
  Prisma,
} from '@prisma/client';
import {
  AdminQuestionDto,
  AdminQuestionListResponseDto,
  AdminStatsDto,
  AdminUserDto,
} from '../dto/admin-question.dto';
import { QuestionInputDto } from '../dto/question-input.dto';
import { AdminQuestionsQueryDto } from '../dto/admin-questions-query.dto';

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * T081: List questions with filters, pagination
   */
  async findAll(
    query: AdminQuestionsQueryDto,
  ): Promise<AdminQuestionListResponseDto> {
    const {
      examTypeId,
      status,
      domain,
      difficulty,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.QuestionWhereInput = {
      examTypeId,
      ...(status && { status: status as QuestionStatus }),
      ...(domain && { domain }),
      ...(difficulty && { difficulty: difficulty as Difficulty }),
    };

    const [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: {
          createdBy: true,
          approvedBy: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.question.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      questions: questions.map((q) => this.toAdminQuestionDto(q)),
      total,
      page,
      totalPages,
    };
  }

  /**
   * T082: Create a new question (status = DRAFT)
   * T090a: Validate min chars and duplicate detection
   */
  async create(
    input: QuestionInputDto,
    adminId: string,
  ): Promise<AdminQuestionDto> {
    // Verify exam type exists
    const examType = await this.prisma.examType.findUnique({
      where: { id: input.examTypeId },
    });
    if (!examType) {
      throw new NotFoundException(`Exam type '${input.examTypeId}' not found`);
    }

    // T090a: Duplicate detection — exact text match
    const duplicate = await this.prisma.question.findFirst({
      where: {
        examTypeId: input.examTypeId,
        text: input.text,
        status: { not: QuestionStatus.ARCHIVED },
      },
    });
    if (duplicate) {
      throw new ConflictException(
        'A question with the exact same text already exists for this exam type',
      );
    }

    // Validate correctAnswers reference valid option IDs
    this.validateCorrectAnswers(input);

    const question = await this.prisma.question.create({
      data: {
        examTypeId: input.examTypeId,
        text: input.text,
        type: input.type as QuestionType,
        domain: input.domain,
        difficulty: input.difficulty as Difficulty,
        options: input.options as unknown as Prisma.InputJsonValue,
        correctAnswers: input.correctAnswers,
        explanation: input.explanation,
        status: QuestionStatus.DRAFT,
        createdById: adminId,
      },
      include: {
        createdBy: true,
        approvedBy: true,
      },
    });

    this.logger.log(`Question created: ${question.id} by admin ${adminId}`);
    return this.toAdminQuestionDto(question);
  }

  /**
   * T083: Get single question by ID
   */
  async findOne(id: string): Promise<AdminQuestionDto> {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        createdBy: true,
        approvedBy: true,
      },
    });

    if (!question) {
      throw new NotFoundException(`Question '${id}' not found`);
    }

    return this.toAdminQuestionDto(question);
  }

  /**
   * T084: Update a question
   */
  async update(id: string, input: QuestionInputDto): Promise<AdminQuestionDto> {
    // Verify question exists
    const existing = await this.prisma.question.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Question '${id}' not found`);
    }

    // Verify exam type exists
    const examType = await this.prisma.examType.findUnique({
      where: { id: input.examTypeId },
    });
    if (!examType) {
      throw new NotFoundException(`Exam type '${input.examTypeId}' not found`);
    }

    // T090a: Duplicate detection — exact text match (exclude current question)
    const duplicate = await this.prisma.question.findFirst({
      where: {
        examTypeId: input.examTypeId,
        text: input.text,
        status: { not: QuestionStatus.ARCHIVED },
        id: { not: id },
      },
    });
    if (duplicate) {
      throw new ConflictException(
        'A question with the exact same text already exists for this exam type',
      );
    }

    // Validate correctAnswers reference valid option IDs
    this.validateCorrectAnswers(input);

    const question = await this.prisma.question.update({
      where: { id },
      data: {
        examTypeId: input.examTypeId,
        text: input.text,
        type: input.type as QuestionType,
        domain: input.domain,
        difficulty: input.difficulty as Difficulty,
        options: input.options as unknown as Prisma.InputJsonValue,
        correctAnswers: input.correctAnswers,
        explanation: input.explanation,
        // Reset to DRAFT on edit if previously pending/approved
        status: QuestionStatus.DRAFT,
      },
      include: {
        createdBy: true,
        approvedBy: true,
      },
    });

    this.logger.log(`Question updated: ${question.id}`);
    return this.toAdminQuestionDto(question);
  }

  /**
   * T085: Approve a question (must be PENDING status)
   * Version is based on total approved question count, not an incrementing counter
   */
  async approve(id: string, adminId: string): Promise<AdminQuestionDto> {
    const existing = await this.prisma.question.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Question '${id}' not found`);
    }

    if (existing.status !== QuestionStatus.PENDING) {
      throw new BadRequestException(
        'Only questions with PENDING status can be approved',
      );
    }

    // Update question with approval info
    const question = await this.prisma.question.update({
      where: { id },
      data: {
        status: QuestionStatus.APPROVED,
        approvedById: adminId,
        approvedAt: new Date(),
      },
      include: {
        createdBy: true,
        approvedBy: true,
      },
    });

    this.logger.log(`Question approved: ${question.id} by admin ${adminId}`);
    return this.toAdminQuestionDto(question);
  }

  /**
   * T086: Archive a question
   */
  async archive(id: string): Promise<AdminQuestionDto> {
    const existing = await this.prisma.question.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Question '${id}' not found`);
    }

    const question = await this.prisma.question.update({
      where: { id },
      data: {
        status: QuestionStatus.ARCHIVED,
        archivedAt: new Date(),
      },
      include: {
        createdBy: true,
        approvedBy: true,
      },
    });

    this.logger.log(`Question archived: ${question.id}`);
    return this.toAdminQuestionDto(question);
  }

  /**
   * T087: Restore an archived question (back to PENDING)
   */
  async restore(id: string): Promise<AdminQuestionDto> {
    const existing = await this.prisma.question.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Question '${id}' not found`);
    }

    const question = await this.prisma.question.update({
      where: { id },
      data: {
        status: QuestionStatus.PENDING,
        archivedAt: null,
      },
      include: {
        createdBy: true,
        approvedBy: true,
      },
    });

    this.logger.log(`Question restored: ${question.id}`);
    return this.toAdminQuestionDto(question);
  }

  /**
   * T089: Get admin stats (totals, by status, by domain)
   */
  async getStats(examTypeId?: string): Promise<AdminStatsDto> {
    const baseWhere: Prisma.QuestionWhereInput = examTypeId
      ? { examTypeId }
      : {};

    // Count questions by status
    const [totalQuestions, draft, pending, approved, archived] =
      await Promise.all([
        this.prisma.question.count({ where: baseWhere }),
        this.prisma.question.count({
          where: { ...baseWhere, status: QuestionStatus.DRAFT },
        }),
        this.prisma.question.count({
          where: { ...baseWhere, status: QuestionStatus.PENDING },
        }),
        this.prisma.question.count({
          where: { ...baseWhere, status: QuestionStatus.APPROVED },
        }),
        this.prisma.question.count({
          where: { ...baseWhere, status: QuestionStatus.ARCHIVED },
        }),
      ]);

    // Count by domain using groupBy
    const domainGroups = await this.prisma.question.groupBy({
      by: ['domain'],
      where: baseWhere,
      _count: { _all: true },
    });

    const byDomain: Record<string, number> = {};
    for (const group of domainGroups) {
      byDomain[group.domain] = group._count._all;
    }

    return {
      totalQuestions,
      byStatus: { draft, pending, approved, archived },
      byDomain,
    };
  }

  /**
   * Validate that correctAnswers references valid option IDs
   */
  private validateCorrectAnswers(input: QuestionInputDto): void {
    const optionIds = new Set(input.options.map((o) => o.id));
    for (const answer of input.correctAnswers) {
      if (!optionIds.has(answer)) {
        throw new BadRequestException(
          `correctAnswer '${answer}' does not match any option ID`,
        );
      }
    }
  }

  /**
   * Map Prisma question model to AdminQuestionDto
   */
  private toAdminQuestionDto(question: {
    id: string;
    examTypeId: string;
    text: string;
    type: QuestionType;
    domain: string;
    difficulty: Difficulty;
    options: unknown;
    correctAnswers: string[];
    explanation: string;
    status: QuestionStatus;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    approvedAt: Date | null;
    archivedAt: Date | null;
    createdBy?: { id: string; email: string; name: string } | null;
    approvedBy?: { id: string; email: string; name: string } | null;
  }): AdminQuestionDto {
    const toAdminUser = (
      admin: { id: string; email: string; name: string } | null | undefined,
    ): AdminUserDto | null => {
      if (!admin) return null;
      return { id: admin.id, email: admin.email, name: admin.name };
    };

    return {
      id: question.id,
      examTypeId: question.examTypeId,
      text: question.text,
      type: question.type,
      domain: question.domain,
      difficulty: question.difficulty,
      options: question.options as { id: string; text: string }[],
      correctAnswers: question.correctAnswers,
      explanation: question.explanation,
      status: question.status,
      version: question.version,
      createdBy: toAdminUser(question.createdBy),
      approvedBy: toAdminUser(question.approvedBy),
      approvedAt: question.approvedAt?.toISOString() ?? null,
      archivedAt: question.archivedAt?.toISOString() ?? null,
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt.toISOString(),
    };
  }
}

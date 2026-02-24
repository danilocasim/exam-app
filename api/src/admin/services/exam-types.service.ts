import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ExamType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExamTypeDto } from '../dto/create-exam-type.dto';
import { UpdateExamTypeDto } from '../dto/update-exam-type.dto';

/**
 * T227: AdminExamTypesService
 * Handles CRUD operations for ExamType entities via the admin portal.
 */
@Injectable()
export class AdminExamTypesService {
  private readonly logger = new Logger(AdminExamTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new exam type.
   * Returns 409 Conflict if the ID already exists.
   */
  async create(dto: CreateExamTypeDto): Promise<ExamType> {
    const existing = await this.prisma.examType.findUnique({
      where: { id: dto.id },
    });

    if (existing) {
      throw new ConflictException(
        `ExamType with id '${dto.id}' already exists`,
      );
    }

    const examType = await this.prisma.examType.create({
      data: {
        id: dto.id,
        name: dto.name,
        displayName: dto.displayName,
        description: dto.description ?? null,
        domains: dto.domains as unknown as Prisma.InputJsonValue,
        passingScore: dto.passingScore,
        timeLimit: dto.timeLimit,
        questionCount: dto.questionCount,
      },
    });

    this.logger.log(`Created ExamType '${examType.id}' (${examType.name})`);
    return examType;
  }

  /**
   * Update an existing exam type (all fields except ID).
   * Returns 404 if the exam type does not exist.
   */
  async update(id: string, dto: UpdateExamTypeDto): Promise<ExamType> {
    await this.findOrThrow(id);

    const examType = await this.prisma.examType.update({
      where: { id },
      data: {
        name: dto.name,
        displayName: dto.displayName,
        description: dto.description ?? null,
        domains: dto.domains as unknown as Prisma.InputJsonValue,
        passingScore: dto.passingScore,
        timeLimit: dto.timeLimit,
        questionCount: dto.questionCount,
      },
    });

    this.logger.log(`Updated ExamType '${examType.id}'`);
    return examType;
  }

  /**
   * Toggle the isActive flag on an exam type.
   * Returns 404 if the exam type does not exist.
   */
  async toggleActive(id: string): Promise<ExamType> {
    const existing = await this.findOrThrow(id);

    const examType = await this.prisma.examType.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    this.logger.log(
      `Toggled ExamType '${id}' isActive: ${existing.isActive} → ${examType.isActive}`,
    );
    return examType;
  }

  /**
   * Find an exam type by ID or throw 404.
   */
  private async findOrThrow(id: string): Promise<ExamType> {
    const examType = await this.prisma.examType.findUnique({
      where: { id },
    });

    if (!examType) {
      throw new NotFoundException(`ExamType with id '${id}' not found`);
    }

    return examType;
  }
}

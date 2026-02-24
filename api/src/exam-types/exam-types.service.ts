import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExamTypeResponseDto,
  ExamDomainDto,
  QuestionBankResponseDto,
  QuestionDto,
  QuestionOptionDto,
  VersionResponseDto,
} from './dto';
import { QuestionType, Difficulty, QuestionStatus } from '@prisma/client';

@Injectable()
export class ExamTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string): Promise<ExamTypeResponseDto> {
    let examType;
    try {
      examType = await this.prisma.examType.findUnique({
        where: { id },
      });
    } catch (err) {
      // Log Prisma error details for debugging
      console.error('[ExamTypesService.findOne] Prisma error:', err);
      throw new Error('Database query failed: ' + (err?.message || err));
    }

    if (!examType) {
      throw new NotFoundException(`Exam type '${id}' not found`);
    }

    if (!examType.isActive) {
      throw new NotFoundException(`Exam type '${id}' is not active`);
    }

    let domainsParsed: ExamDomainDto[] = [];
    try {
      // Defensive: domains may be string or object
      domainsParsed =
        typeof examType.domains === 'string'
          ? JSON.parse(examType.domains)
          : examType.domains;
    } catch (err) {
      console.error(
        '[ExamTypesService.findOne] Domains parse error:',
        err,
        'domains:',
        examType.domains,
      );
      throw new Error('ExamType domains field is invalid JSON');
    }

    // Get live count of approved questions from the database
    const liveQuestionCount = await this.prisma.question.count({
      where: {
        examTypeId: id,
        status: QuestionStatus.APPROVED,
      },
    });

    return {
      id: examType.id,
      name: examType.name,
      displayName: examType.displayName,
      description: examType.description,
      domains: domainsParsed,
      passingScore: examType.passingScore,
      timeLimit: examType.timeLimit,
      questionCount: liveQuestionCount,
      isActive: examType.isActive,
    };
  }

  /**
   * Get questions for an exam type with pagination
   * T031: GET /exam-types/{examTypeId}/questions
   * Version = total count of approved questions
   */
  async getQuestions(
    examTypeId: string,
    since?: number,
    limit: number = 100,
  ): Promise<QuestionBankResponseDto> {
    // Verify exam type exists and is active
    await this.findOne(examTypeId);

    // Build query conditions - fetch all approved questions
    const whereCondition = {
      examTypeId,
      status: QuestionStatus.APPROVED,
    };

    // Get questions ordered by createdAt (oldest first for sync)
    const questions = await this.prisma.question.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'asc' },
      take: limit + 1, // Get one extra to check if there's more
      ...(since !== undefined && { skip: since }), // Use offset-based pagination
    });

    // Determine if there are more questions
    const hasMore = questions.length > limit;
    const returnQuestions = hasMore ? questions.slice(0, limit) : questions;

    // Get total count of approved questions (this IS the version)
    const totalCount = await this.prisma.question.count({
      where: {
        examTypeId,
        status: QuestionStatus.APPROVED,
      },
    });

    // Map to DTOs
    const questionDtos: QuestionDto[] = returnQuestions.map((q) =>
      this.mapQuestionToDto(q),
    );

    const response: QuestionBankResponseDto = {
      questions: questionDtos,
      latestVersion: 1,
      hasMore,
    };

    if (hasMore) {
      response.nextSince = (since ?? 0) + limit;
    }

    return response;
  }

  /**
   * Get the latest version info for question bank
   * T032: GET /exam-types/{examTypeId}/questions/version
   * Version = total count of approved questions (not an incrementing counter)
   */
  async getVersion(examTypeId: string): Promise<VersionResponseDto> {
    // Verify exam type exists and is active
    await this.findOne(examTypeId);

    // Get aggregate stats for approved questions
    const stats = await this.prisma.question.aggregate({
      where: {
        examTypeId,
        status: QuestionStatus.APPROVED,
      },
      _max: { updatedAt: true },
      _count: { id: true },
    });

    const questionCount = stats._count.id;

    return {
      latestVersion: 1,
      questionCount,
      lastUpdatedAt: stats._max.updatedAt?.toISOString(),
    };
  }

  /**
   * Map Prisma Question model to QuestionDto
   */
  private mapQuestionToDto(question: {
    id: string;
    text: string;
    type: QuestionType;
    domain: string;
    difficulty: Difficulty;
    options: unknown;
    correctAnswers: string[];
    explanation: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): QuestionDto {
    return {
      id: question.id,
      text: question.text,
      type: this.mapQuestionType(question.type),
      domain: question.domain,
      difficulty: this.mapDifficulty(question.difficulty),
      options: question.options as QuestionOptionDto[],
      correctAnswers: question.correctAnswers,
      explanation: question.explanation,
      version: 1,
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt.toISOString(),
    };
  }

  /**
   * Map Prisma QuestionType enum to API string value
   */
  private mapQuestionType(
    type: QuestionType,
  ): 'single-choice' | 'multiple-choice' | 'true-false' {
    const typeMap: Record<
      QuestionType,
      'single-choice' | 'multiple-choice' | 'true-false'
    > = {
      SINGLE_CHOICE: 'single-choice',
      MULTIPLE_CHOICE: 'multiple-choice',
      TRUE_FALSE: 'true-false',
    };
    return typeMap[type];
  }

  /**
   * Map Prisma Difficulty enum to API string value
   */
  private mapDifficulty(difficulty: Difficulty): 'easy' | 'medium' | 'hard' {
    const difficultyMap: Record<Difficulty, 'easy' | 'medium' | 'hard'> = {
      EASY: 'easy',
      MEDIUM: 'medium',
      HARD: 'hard',
    };
    return difficultyMap[difficulty];
  }
}

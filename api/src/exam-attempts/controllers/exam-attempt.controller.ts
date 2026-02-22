import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  UseInterceptors,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ExamAttemptService } from '../services/exam-attempt.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';

// === DTOs ===

export class SubmitExamAttemptDto {
  examTypeId: string;
  score: number;
  passed: boolean;
  duration: number; // Seconds
  submittedAt?: Date;
}

export class ExamAttemptResponse {
  id: string;
  userId?: string;
  examTypeId: string;
  score: number;
  passed: boolean;
  duration: number;
  submittedAt: Date;
  createdAt: Date;
  syncStatus: string;
  syncedAt?: Date;
  syncRetries: number;
}

export class ExamAttemptListResponse {
  data: ExamAttemptResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class AnalyticsResponse {
  totalAttempts: number;
  totalPassed: number;
  passRate: number;
  averageScore: number;
  averageDuration: number;
}

/**
 * REST API endpoints for exam attempt submission, retrieval, and analytics
 * Protected routes require JWT authentication
 * Public route allows unsigned exam submissions (no user association)
 */
@Controller('exam-attempts')
@UseInterceptors(LoggingInterceptor)
export class ExamAttemptController {
  constructor(private examAttemptService: ExamAttemptService) {}

  /**
   * POST /exam-attempts/submit
   * Submit exam attempt (public endpoint - allows unsigned users)
   * @param dto - Exam submission data
   * @returns Created exam attempt
   */
  @Post('submit')
  @HttpCode(201)
  async submitExam(
    @Body() dto: SubmitExamAttemptDto,
  ): Promise<ExamAttemptResponse> {
    // Validate input
    if (dto.score < 0 || dto.score > 100) {
      throw new BadRequestException('Score must be between 0 and 100');
    }
    if (dto.duration < 0) {
      throw new BadRequestException('Duration must be non-negative');
    }

    const attempt = await this.examAttemptService.create({
      examTypeId: dto.examTypeId,
      score: dto.score,
      passed: dto.passed,
      duration: dto.duration,
      submittedAt: dto.submittedAt,
    });

    return this.mapToResponse(attempt);
  }

  /**
   * POST /exam-attempts/submit-authenticated
   * Submit exam attempt as authenticated user
   * Tracked for cloud sync
   * @param userId - Current user (from JWT)
   * @param dto - Exam submission data
   * @returns Created exam attempt with sync tracking
   */
  @Post('submit-authenticated')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  async submitExamAuthenticated(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubmitExamAttemptDto,
  ): Promise<ExamAttemptResponse> {
    // Validate input
    if (dto.score < 0 || dto.score > 100) {
      throw new BadRequestException('Score must be between 0 and 100');
    }
    if (dto.duration < 0) {
      throw new BadRequestException('Duration must be non-negative');
    }

    const attempt = await this.examAttemptService.create({
      userId,
      examTypeId: dto.examTypeId,
      score: dto.score,
      passed: dto.passed,
      duration: dto.duration,
      submittedAt: dto.submittedAt,
    });

    return this.mapToResponse(attempt);
  }

  /**
   * GET /exam-attempts/my-history
   * Get current user's exam history
   * @param userId - Current user (from JWT)
   * @param page - Page number (1-indexed)
   * @param limit - Items per page
   * @param examTypeId - Optional filter by exam type
   * @returns Paginated exam history
   */
  @Get('my-history')
  @UseGuards(JwtAuthGuard)
  async getMyHistory(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('examTypeId') examTypeId?: string,
  ): Promise<ExamAttemptListResponse> {
    const result = await this.examAttemptService.findByUserId(userId, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      examTypeId,
    });

    return {
      data: result.data.map((a) => this.mapToResponse(a)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /**
   * GET /exam-attempts/:id
   * Get single exam attempt by ID
   * Users can only access their own attempts
   * @param id - Exam attempt ID
   * @param userId - Current user (from JWT, optional)
   * @returns Exam attempt details
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getExamAttempt(
    @Param('id') id: string,
    @CurrentUser('userId') userId?: string,
  ): Promise<ExamAttemptResponse> {
    const attempt = await this.examAttemptService.findById(id);

    if (!attempt) {
      throw new NotFoundException(`Exam attempt not found: ${id}`);
    }

    // Security: If user is authenticated, verify ownership
    if (userId && attempt.userId && attempt.userId !== userId) {
      throw new NotFoundException('Exam attempt not found');
    }

    return this.mapToResponse(attempt);
  }

  /**
   * POST /exam-attempts/:id/mark-synced
   * Mark exam attempt as successfully synced (admin/backend only)
   * @param id - Exam attempt ID
   * @returns Updated exam attempt
   */
  @Post(':id/mark-synced')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async markSynced(@Param('id') id: string): Promise<ExamAttemptResponse> {
    const attempt = await this.examAttemptService.markSynced(id);
    return this.mapToResponse(attempt);
  }

  /**
   * POST /exam-attempts/:id/mark-failed
   * Mark exam attempt as failed sync (admin/backend only)
   * @param id - Exam attempt ID
   * @param error - Optional error message
   * @returns Updated exam attempt
   */
  @Post(':id/mark-failed')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async markFailed(
    @Param('id') id: string,
    @Body('error') error?: string,
  ): Promise<ExamAttemptResponse> {
    const attempt = await this.examAttemptService.markFailed(id, error);
    return this.mapToResponse(attempt);
  }

  /**
   * GET /exam-attempts/my-analytics
   * Get user's analytics summary
   * @param userId - Current user (from JWT)
   * @param examTypeId - Optional filter by exam type
   * @returns Aggregated analytics
   */
  @Get('analytics/my-analytics')
  @UseGuards(JwtAuthGuard)
  async getMyAnalytics(
    @CurrentUser('userId') userId: string,
    @Query('examTypeId') examTypeId?: string,
  ): Promise<AnalyticsResponse> {
    return this.examAttemptService.getAnalytics(userId, examTypeId);
  }

  // === Helper Methods ===

  private mapToResponse(attempt: any): ExamAttemptResponse {
    return {
      id: attempt.id,
      userId: attempt.userId,
      examTypeId: attempt.examTypeId,
      score: attempt.score,
      passed: attempt.passed,
      duration: attempt.duration,
      submittedAt: attempt.submittedAt,
      createdAt: attempt.createdAt,
      syncStatus: attempt.syncStatus,
      syncedAt: attempt.syncedAt,
      syncRetries: attempt.syncRetries,
    };
  }
}

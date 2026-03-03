import { Controller, Get, Put, Body, UseGuards, UseInterceptors } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsISO8601, Min } from 'class-validator';
import { UserStatsService } from '../services/user-stats.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';

export class UpsertUserStatsBody {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalExams?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalPractice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalQuestions?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalTimeSpentMs?: number;

  @IsOptional()
  @IsISO8601()
  lastActivityAt?: string | null; // ISO string from mobile

  @IsOptional()
  @IsISO8601()
  dailyQuizLastCompletedAt?: string | null;

  @IsOptional()
  @IsISO8601()
  missedQuizLastCompletedAt?: string | null;
}

export class UserStatsResponse {
  totalExams: number;
  totalPractice: number;
  totalQuestions: number;
  totalTimeSpentMs: number;
  lastActivityAt: string | null;
  dailyQuizLastCompletedAt: string | null;
  missedQuizLastCompletedAt: string | null;
}

/**
 * REST endpoints for user statistics persistence.
 * All routes require JWT authentication.
 *
 * GET  /user-stats/me   — fetch stored stats
 * PUT  /user-stats/me   — merge-upsert (MAX strategy)
 */
@Controller('user-stats')
@UseGuards(JwtAuthGuard)
@UseInterceptors(LoggingInterceptor)
export class UserStatsController {
  constructor(private userStatsService: UserStatsService) {}

  @Get('me')
  async getMyStats(@CurrentUser('userId') userId: string): Promise<UserStatsResponse> {
    let stats = await this.userStatsService.getByUserId(userId);
    if (!stats) {
      // Lazily initialise stats row for this user with zeros so that the
      // table always contains a record once the user has accessed it.
      stats = await this.userStatsService.upsert(userId, {
        totalExams: 0,
        totalPractice: 0,
        totalQuestions: 0,
        totalTimeSpentMs: 0,
        lastActivityAt: null,
        dailyQuizLastCompletedAt: null,
        missedQuizLastCompletedAt: null,
      });
    }
    return {
      totalExams: stats.totalExams,
      totalPractice: stats.totalPractice,
      totalQuestions: stats.totalQuestions,
      totalTimeSpentMs: Number(stats.totalTimeSpentMs),
      lastActivityAt: stats.lastActivityAt?.toISOString() ?? null,
      dailyQuizLastCompletedAt: stats.dailyQuizLastCompletedAt?.toISOString() ?? null,
      missedQuizLastCompletedAt: stats.missedQuizLastCompletedAt?.toISOString() ?? null,
    };
  }

  @Put('me')
  async upsertMyStats(
    @CurrentUser('userId') userId: string,
    @Body() body: UpsertUserStatsBody,
  ): Promise<UserStatsResponse> {
    const stats = await this.userStatsService.upsert(userId, {
      totalExams: body.totalExams ?? 0,
      totalPractice: body.totalPractice ?? 0,
      totalQuestions: body.totalQuestions ?? 0,
      totalTimeSpentMs: body.totalTimeSpentMs ?? 0,
      lastActivityAt: body.lastActivityAt ? new Date(body.lastActivityAt) : null,
      dailyQuizLastCompletedAt: body.dailyQuizLastCompletedAt
        ? new Date(body.dailyQuizLastCompletedAt)
        : null,
      missedQuizLastCompletedAt: body.missedQuizLastCompletedAt
        ? new Date(body.missedQuizLastCompletedAt)
        : null,
    });
    return {
      totalExams: stats.totalExams,
      totalPractice: stats.totalPractice,
      totalQuestions: stats.totalQuestions,
      totalTimeSpentMs: Number(stats.totalTimeSpentMs),
      lastActivityAt: stats.lastActivityAt?.toISOString() ?? null,
      dailyQuizLastCompletedAt: stats.dailyQuizLastCompletedAt?.toISOString() ?? null,
      missedQuizLastCompletedAt: stats.missedQuizLastCompletedAt?.toISOString() ?? null,
    };
  }
}

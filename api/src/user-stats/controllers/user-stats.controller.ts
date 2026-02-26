import { Controller, Get, Put, Body, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserStatsService } from '../services/user-stats.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';

export class UpsertUserStatsBody {
  totalExams: number;
  totalPractice: number;
  totalQuestions: number;
  totalTimeSpentMs: number;
  lastActivityAt?: string | null; // ISO string from mobile
}

export class UserStatsResponse {
  totalExams: number;
  totalPractice: number;
  totalQuestions: number;
  totalTimeSpentMs: number;
  lastActivityAt: string | null;
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
    const stats = await this.userStatsService.getByUserId(userId);
    if (!stats) {
      return {
        totalExams: 0,
        totalPractice: 0,
        totalQuestions: 0,
        totalTimeSpentMs: 0,
        lastActivityAt: null,
      };
    }
    return {
      totalExams: stats.totalExams,
      totalPractice: stats.totalPractice,
      totalQuestions: stats.totalQuestions,
      totalTimeSpentMs: Number(stats.totalTimeSpentMs),
      lastActivityAt: stats.lastActivityAt?.toISOString() ?? null,
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
    });
    return {
      totalExams: stats.totalExams,
      totalPractice: stats.totalPractice,
      totalQuestions: stats.totalQuestions,
      totalTimeSpentMs: Number(stats.totalTimeSpentMs),
      lastActivityAt: stats.lastActivityAt?.toISOString() ?? null,
    };
  }
}

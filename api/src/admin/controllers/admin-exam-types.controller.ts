import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionsService } from '../services';
import { AdminStatsDto } from '../dto';

/**
 * T088: GET /admin/exam-types
 * T089: GET /admin/stats
 */
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminExamTypesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questionsService: QuestionsService,
  ) {}

  /**
   * T088: GET /admin/exam-types - List all exam types for admin
   */
  @Get('exam-types')
  async findAllExamTypes() {
    const examTypes = await this.prisma.examType.findMany({
      orderBy: { name: 'asc' },
    });

    return examTypes.map((et) => ({
      id: et.id,
      name: et.name,
      displayName: et.displayName,
      description: et.description,
      domains: et.domains,
      passingScore: et.passingScore,
      timeLimit: et.timeLimit,
      questionCount: et.questionCount,
      isActive: et.isActive,
    }));
  }

  /**
   * T089: GET /admin/stats - Get admin dashboard stats
   */
  @Get('stats')
  async getStats(
    @Query('examTypeId') examTypeId?: string,
  ): Promise<AdminStatsDto> {
    return this.questionsService.getStats(examTypeId);
  }
}

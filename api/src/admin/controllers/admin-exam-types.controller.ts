import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Query,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ExamType } from '@prisma/client';
import { JwtAuthGuard } from '../guards';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionsService, AdminExamTypesService } from '../services';
import { AdminStatsDto, CreateExamTypeDto, UpdateExamTypeDto } from '../dto';

/**
 * T088: GET /admin/exam-types
 * T089: GET /admin/stats
 * T228: POST /admin/exam-types
 * T229: PUT /admin/exam-types/:id
 * T230: PATCH /admin/exam-types/:id
 */
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminExamTypesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questionsService: QuestionsService,
    private readonly adminExamTypesService: AdminExamTypesService,
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

  /**
   * T228: POST /admin/exam-types - Create a new exam type
   * Returns 201 on success, 409 on duplicate ID, 400 on validation failure.
   */
  @Post('exam-types')
  @HttpCode(HttpStatus.CREATED)
  async createExamType(@Body() dto: CreateExamTypeDto): Promise<ExamType> {
    return this.adminExamTypesService.create(dto);
  }

  /**
   * T229: PUT /admin/exam-types/:id - Update an existing exam type
   * Returns 200 on success, 404 if not found, 400 on validation failure.
   */
  @Put('exam-types/:id')
  async updateExamType(
    @Param('id') id: string,
    @Body() dto: UpdateExamTypeDto,
  ): Promise<ExamType> {
    return this.adminExamTypesService.update(id, dto);
  }

  /**
   * T230: PATCH /admin/exam-types/:id - Toggle isActive
   * Returns 200 on success, 404 if not found.
   */
  @Patch('exam-types/:id')
  async toggleExamType(@Param('id') id: string): Promise<ExamType> {
    return this.adminExamTypesService.toggleActive(id);
  }
}

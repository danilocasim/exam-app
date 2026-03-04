import { Controller, Get, Param, Query } from '@nestjs/common';
import { ExamTypesService } from './exam-types.service';
import {
  ExamTypeResponseDto,
  GetQuestionsQueryDto,
  QuestionBankResponseDto,
  VersionResponseDto,
  QuestionSetPublicDto,
} from './dto';

@Controller('exam-types')
export class ExamTypesController {
  constructor(private readonly examTypesService: ExamTypesService) {}

  @Get(':id')
  async getExamType(@Param('id') id: string): Promise<ExamTypeResponseDto> {
    return this.examTypesService.findOne(id);
  }

  /**
   * GET /exam-types/{examTypeId}/sets
   * Get all question sets for a given exam type (public, for mobile sync)
   */
  @Get(':examTypeId/sets')
  async getSets(
    @Param('examTypeId') examTypeId: string,
  ): Promise<{ sets: QuestionSetPublicDto[] }> {
    return this.examTypesService.getSets(examTypeId);
  }

  /**
   * T031: GET /exam-types/{examTypeId}/questions
   * Get question bank updates for exam type
   */
  @Get(':examTypeId/questions')
  async getQuestions(
    @Param('examTypeId') examTypeId: string,
    @Query() query: GetQuestionsQueryDto,
  ): Promise<QuestionBankResponseDto> {
    return this.examTypesService.getQuestions(
      examTypeId,
      query.since,
      query.limit,
      query.sets,
    );
  }

  /**
   * T032: GET /exam-types/{examTypeId}/questions/version
   * Get latest question bank version for exam type
   */
  @Get(':examTypeId/questions/version')
  async getVersion(
    @Param('examTypeId') examTypeId: string,
  ): Promise<VersionResponseDto> {
    return this.examTypesService.getVersion(examTypeId);
  }
}

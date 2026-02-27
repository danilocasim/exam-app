import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../guards';
import { CurrentAdmin } from '../decorators';
import type { AdminUser } from '../auth/admin-auth.service';
import { QuestionsService } from '../services';
import { BulkImportService } from '../services/bulk-import.service';
import {
  QuestionInputDto,
  AdminQuestionDto,
  AdminQuestionListResponseDto,
  AdminQuestionsQueryDto,
} from '../dto';
import {
  BulkImportQuestionsDto,
  type BulkImportValidationResult,
  type BulkImportResult,
} from '../dto/bulk-import-questions.dto';

/**
 * T081-T087: Admin questions CRUD controller
 * All endpoints require JWT auth
 */
@Controller('admin/questions')
@UseGuards(JwtAuthGuard)
export class AdminQuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly bulkImportService: BulkImportService,
  ) {}

  /**
   * T081: GET /admin/questions - List questions with filters
   */
  @Get()
  async findAll(
    @Query() query: AdminQuestionsQueryDto,
  ): Promise<AdminQuestionListResponseDto> {
    return this.questionsService.findAll(query);
  }

  /**
   * T082: POST /admin/questions - Create a new question
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() input: QuestionInputDto,
    @CurrentAdmin() admin: AdminUser,
  ): Promise<AdminQuestionDto> {
    return this.questionsService.create(input, admin.id);
  }

  // -------------------------------------------------------------------------
  // Bulk import (static segments — must be defined before /:id routes)
  // -------------------------------------------------------------------------

  /**
   * GET /admin/questions/bulk-import/template
   * Returns a downloadable JSON template file (with inline documentation).
   */
  @Get('bulk-import/template')
  async getBulkImportTemplate(
    @Query('examTypeId') examTypeId: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const json = await this.bulkImportService.getTemplate(examTypeId);
    const filename = examTypeId
      ? `questions-template-${examTypeId}.json`
      : 'questions-template.json';

    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(json);
  }

  /**
   * POST /admin/questions/bulk-import/validate
   * Dry-run validation: returns errors and duplicate info without persisting.
   */
  @Post('bulk-import/validate')
  @HttpCode(HttpStatus.OK)
  async validateBulkImport(
    @Body() dto: BulkImportQuestionsDto,
  ): Promise<BulkImportValidationResult> {
    return this.bulkImportService.validate(dto);
  }

  /**
   * POST /admin/questions/bulk-import
   * Validates and atomically imports all questions in one DB transaction.
   * Returns 422 if validation fails (no partial inserts).
   */
  @Post('bulk-import')
  @HttpCode(HttpStatus.CREATED)
  async bulkImport(
    @Body() dto: BulkImportQuestionsDto,
    @CurrentAdmin() admin: AdminUser,
  ): Promise<BulkImportResult> {
    return this.bulkImportService.importQuestions(dto, admin.id);
  }

  // -------------------------------------------------------------------------

  /**
   * T083: GET /admin/questions/:id - Get single question
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<AdminQuestionDto> {
    return this.questionsService.findOne(id);
  }

  /**
   * T084: PUT /admin/questions/:id - Update a question
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() input: QuestionInputDto,
  ): Promise<AdminQuestionDto> {
    return this.questionsService.update(id, input);
  }

  /**
   * T085: POST /admin/questions/:id/approve - Approve question
   */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminUser,
  ): Promise<AdminQuestionDto> {
    return this.questionsService.approve(id, admin.id);
  }

  /**
   * T086: POST /admin/questions/:id/archive - Archive question
   */
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(@Param('id') id: string): Promise<AdminQuestionDto> {
    return this.questionsService.archive(id);
  }

  /**
   * T087: POST /admin/questions/:id/restore - Restore question
   */
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  async restore(@Param('id') id: string): Promise<AdminQuestionDto> {
    return this.questionsService.restore(id);
  }
}

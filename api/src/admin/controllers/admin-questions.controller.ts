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
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards';
import { CurrentAdmin } from '../decorators';
import type { AdminUser } from '../auth/admin-auth.service';
import { QuestionsService } from '../services';
import {
  QuestionInputDto,
  AdminQuestionDto,
  AdminQuestionListResponseDto,
  AdminQuestionsQueryDto,
} from '../dto';

/**
 * T081-T087: Admin questions CRUD controller
 * All endpoints require JWT auth
 */
@Controller('admin/questions')
@UseGuards(JwtAuthGuard)
export class AdminQuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

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

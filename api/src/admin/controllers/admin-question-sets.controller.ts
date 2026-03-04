import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards';
import { QuestionSetsService } from '../services/question-sets.service';
import {
  CreateQuestionSetDto,
  UpdateQuestionSetDto,
  QuestionSetResponseDto,
} from '../dto/question-set.dto';

@Controller('admin/question-sets')
@UseGuards(JwtAuthGuard)
export class AdminQuestionSetsController {
  constructor(private readonly questionSetsService: QuestionSetsService) {}

  /**
   * GET /admin/question-sets?examTypeId=...&includeArchived=true
   * List all sets for an exam type. Archived sets hidden by default.
   */
  @Get()
  async findAll(
    @Query('examTypeId') examTypeId: string,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<QuestionSetResponseDto[]> {
    return this.questionSetsService.findAll(
      examTypeId,
      includeArchived === 'true',
    );
  }

  /**
   * GET /admin/question-sets/:id
   * Get a single set by ID.
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<QuestionSetResponseDto> {
    return this.questionSetsService.findOne(id);
  }

  /**
   * POST /admin/question-sets?examTypeId=...
   * Create a new set.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Query('examTypeId') examTypeId: string,
    @Body() dto: CreateQuestionSetDto,
  ): Promise<QuestionSetResponseDto> {
    return this.questionSetsService.create(
      examTypeId,
      dto.name,
      dto.slug,
      dto.description,
    );
  }

  /**
   * PUT /admin/question-sets/:id
   * Update a set (name and description).
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionSetDto,
  ): Promise<QuestionSetResponseDto> {
    return this.questionSetsService.update(id, dto);
  }

  /**
   * PATCH /admin/question-sets/:id/archive
   * Soft-delete a set. System sets cannot be archived.
   */
  @Patch(':id/archive')
  async archive(@Param('id') id: string): Promise<QuestionSetResponseDto> {
    return this.questionSetsService.archive(id);
  }

  /**
   * PATCH /admin/question-sets/:id/unarchive
   * Restore an archived set.
   */
  @Patch(':id/unarchive')
  async unarchive(@Param('id') id: string): Promise<QuestionSetResponseDto> {
    return this.questionSetsService.unarchive(id);
  }
}

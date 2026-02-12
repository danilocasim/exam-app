import { Controller, Get, Param } from '@nestjs/common';
import { ExamTypesService } from './exam-types.service';
import { ExamTypeResponseDto } from './dto';

@Controller('exam-types')
export class ExamTypesController {
  constructor(private readonly examTypesService: ExamTypesService) {}

  @Get(':id')
  async getExamType(@Param('id') id: string): Promise<ExamTypeResponseDto> {
    return this.examTypesService.findOne(id);
  }
}

import { OmitType } from '@nestjs/mapped-types';
import { CreateExamTypeDto } from './create-exam-type.dto';

/**
 * T226: UpdateExamType DTO
 * Used by PUT /admin/exam-types/:id to update an existing exam type.
 * ID is immutable — only non-ID fields can be updated.
 */
export class UpdateExamTypeDto extends OmitType(CreateExamTypeDto, [
  'id',
] as const) {}

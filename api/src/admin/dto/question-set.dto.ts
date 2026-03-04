import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';

/**
 * DTO for creating a new QuestionSet
 */
export class CreateQuestionSetDto {
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  @MinLength(2, { message: 'name must be at least 2 characters' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'slug is required' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'slug must be lowercase alphanumeric with hyphens (e.g. "set1", "diagnostic")',
  })
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * DTO for updating a QuestionSet
 */
export class UpdateQuestionSetDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'name must be at least 2 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'slug must be lowercase alphanumeric with hyphens (e.g. "set1", "diagnostic")',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Response DTO for a QuestionSet
 */
export interface QuestionSetResponseDto {
  id: string;
  examTypeId: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  archivedAt: string | null;
  questionCount: number;
  createdAt: string;
}

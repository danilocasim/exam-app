import { IsInt, IsOptional, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query parameters for GET /exam-types/{examTypeId}/questions
 */
export class GetQuestionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  since?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;

  /** Comma-separated set slugs to filter by (e.g. "diagnostic,set-1") */
  @IsOptional()
  @IsString()
  sets?: string;
}

/**
 * Option within a question
 */
export class QuestionOptionDto {
  id: string;
  text: string;
}

/**
 * Question DTO for public API response
 * Maps API field names (lowercase enum values) per contracts/api.yaml
 */
export class QuestionDto {
  id: string;
  text: string;
  type: 'single-choice' | 'multiple-choice' | 'true-false';
  domain: string;
  difficulty: 'easy' | 'medium' | 'hard';
  options: QuestionOptionDto[];
  correctAnswers: string[];
  explanation: string;
  explanationBlocks?: ExplanationBlockDto[] | null;
  set?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Structured explanation block for rich content
 */
export class ExplanationBlockDto {
  type: 'paragraph' | 'link' | 'image' | 'bullet_list' | 'code' | 'separator';
  content: string;
  meta?: {
    alt?: string;
    caption?: string;
    width?: number;
    height?: number;
    listItems?: string[];
    label?: string;
  };
}

/**
 * Response for GET /exam-types/{examTypeId}/questions
 */
export class QuestionBankResponseDto {
  questions: QuestionDto[];
  latestVersion: number;
  hasMore: boolean;
  nextSince?: number;
}

/**
 * Response for GET /exam-types/{examTypeId}/questions/version
 */
export class VersionResponseDto {
  latestVersion: number;
  questionCount: number;
  lastUpdatedAt?: string;
}

/**
 * Public DTO for question sets (mobile sync)
 */
export class QuestionSetPublicDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

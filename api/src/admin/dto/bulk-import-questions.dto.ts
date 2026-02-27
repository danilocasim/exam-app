import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  MinLength,
  ValidateNested,
  IsOptional,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

/**
 * A single option within a bulk-import question.
 */
export class BulkImportOptionDto {
  @IsString()
  @IsNotEmpty({ message: 'Option id must not be empty' })
  id: string;

  @IsString()
  @IsNotEmpty({ message: 'Option text must not be empty' })
  text: string;
}

/**
 * A single question entry in the bulk-import file.
 * Note: examTypeId is declared at the top-level of the payload — not per question.
 */
export class BulkImportQuestionItemDto {
  @IsString()
  @MinLength(20, { message: 'text must be at least 20 characters' })
  text: string;

  @IsEnum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'], {
    message: 'type must be SINGLE_CHOICE, MULTIPLE_CHOICE, or TRUE_FALSE',
  })
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';

  @IsString()
  @IsNotEmpty({ message: 'domain must not be empty' })
  domain: string;

  @IsEnum(['EASY', 'MEDIUM', 'HARD'], {
    message: 'difficulty must be EASY, MEDIUM, or HARD',
  })
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';

  @IsArray()
  @ArrayMinSize(2, { message: 'At least 2 options are required' })
  @ValidateNested({ each: true })
  @Type(() => BulkImportOptionDto)
  options: BulkImportOptionDto[];

  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 correct answer is required' })
  @IsString({ each: true })
  correctAnswers: string[];

  @IsString()
  @MinLength(50, { message: 'explanation must be at least 50 characters' })
  explanation: string;

  /** Optional structured blocks — same shape as QuestionInputDto */
  @IsOptional()
  explanationBlocks?: Array<{
    type: 'paragraph' | 'link' | 'image' | 'bullet_list' | 'code' | 'separator';
    content: string;
    meta?: Record<string, unknown>;
  }> | null;
}

/**
 * Top-level request body for POST /admin/questions/bulk-import (and /validate).
 *
 * JSON structure the client must upload:
 * {
 *   "examTypeId": "CLF-C02",
 *   "questions": [ { ... }, ... ]
 * }
 */
export class BulkImportQuestionsDto {
  @IsString()
  @IsNotEmpty({ message: 'examTypeId is required' })
  examTypeId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'questions array must have at least 1 item' })
  @ArrayMaxSize(500, { message: 'Maximum 500 questions per upload' })
  @ValidateNested({ each: true })
  @Type(() => BulkImportQuestionItemDto)
  questions: BulkImportQuestionItemDto[];
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/** A structured validation error pointing to a specific question and field. */
export interface ImportValidationError {
  questionIndex: number;
  field: string;
  message: string;
}

/** Identifies a duplicate question — within the uploaded file or in the database. */
export interface ImportDuplicateInfo {
  questionIndex: number;
  /** 'DUPLICATE_IN_FILE' | 'DUPLICATE_IN_DB' */
  reason: 'DUPLICATE_IN_FILE' | 'DUPLICATE_IN_DB';
  /** Original (un-normalized) question text */
  text: string;
  /** Only set for DUPLICATE_IN_FILE: the earlier index that conflicts */
  conflictsWithIndex?: number;
}

/** Summary + details from validation (dry-run or pre-import check). */
export interface BulkImportValidationResult {
  valid: boolean;
  summary: {
    total: number;
    errors: number;
    duplicatesInFile: number;
    duplicatesInDb: number;
  };
  errors: ImportValidationError[];
  duplicates: ImportDuplicateInfo[];
}

/** Returned after a successful import. */
export interface BulkImportResult {
  imported: number;
  examTypeId: string;
  questionIds: string[];
}

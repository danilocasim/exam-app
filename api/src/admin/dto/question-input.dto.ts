import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  ArrayMinSize,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Option within a question input
 */
export class QuestionOptionInputDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  text: string;
}

/**
 * T080: QuestionInput DTO — used for create and update
 * Matches contracts/api.yaml QuestionInput schema
 */
export class QuestionInputDto {
  @IsString()
  @IsNotEmpty()
  examTypeId: string;

  @IsString()
  @MinLength(20, { message: 'Question text must be at least 20 characters' })
  text: string;

  @IsEnum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'], {
    message: 'type must be SINGLE_CHOICE, MULTIPLE_CHOICE, or TRUE_FALSE',
  })
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';

  @IsString()
  @IsNotEmpty()
  domain: string;

  @IsEnum(['EASY', 'MEDIUM', 'HARD'], {
    message: 'difficulty must be EASY, MEDIUM, or HARD',
  })
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';

  @IsArray()
  @ArrayMinSize(2, { message: 'At least 2 options are required' })
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionInputDto)
  options: QuestionOptionInputDto[];

  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 correct answer is required' })
  @IsString({ each: true })
  correctAnswers: string[];

  @IsString()
  @MinLength(50, { message: 'Explanation must be at least 50 characters' })
  explanation: string;
}

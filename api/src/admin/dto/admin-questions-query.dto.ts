import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query parameters for GET /admin/questions
 * Matches contracts/api.yaml parameters
 */
export class AdminQuestionsQueryDto {
  @IsString()
  examTypeId: string;

  @IsOptional()
  @IsEnum(['DRAFT', 'PENDING', 'APPROVED', 'ARCHIVED'], {
    message: 'status must be DRAFT, PENDING, APPROVED, or ARCHIVED',
  })
  status?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'ARCHIVED';

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsEnum(['EASY', 'MEDIUM', 'HARD'], {
    message: 'difficulty must be EASY, MEDIUM, or HARD',
  })
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

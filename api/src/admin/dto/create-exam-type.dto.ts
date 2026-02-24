import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  IsArray,
  Min,
  Max,
  MinLength,
  Matches,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Custom validator: domain weights must sum to 100
 */
@ValidatorConstraint({ name: 'domainWeightsSum', async: false })
export class DomainWeightsSumConstraint implements ValidatorConstraintInterface {
  validate(domains: CreateExamTypeDomainDto[]): boolean {
    if (!Array.isArray(domains) || domains.length === 0) return false;
    const sum = domains.reduce((acc, d) => acc + (d.weight ?? 0), 0);
    return sum === 100;
  }

  defaultMessage(): string {
    return 'Domain weights must sum to exactly 100';
  }
}

/**
 * T225: Domain within an exam type
 */
export class CreateExamTypeDomainDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  weight: number;

  @IsInt()
  @Min(0)
  questionCount: number;
}

/**
 * T225: CreateExamType DTO
 * Used by POST /admin/exam-types to create a new exam type.
 * ID is alphanumeric + hyphens (e.g., "CLF-C02", "SAA-C03").
 */
export class CreateExamTypeDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'id must contain only alphanumeric characters and hyphens',
  })
  id: string;

  @IsString()
  @MinLength(3)
  name: string;

  @IsString()
  @MinLength(2)
  displayName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExamTypeDomainDto)
  @Validate(DomainWeightsSumConstraint)
  domains: CreateExamTypeDomainDto[];

  @IsInt()
  @Min(0)
  @Max(100)
  passingScore: number;

  @IsInt()
  @Min(1)
  timeLimit: number;

  @IsInt()
  @Min(1)
  @Max(500)
  questionCount: number;
}

import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import type { PromptRegressionAssertions } from '@ai-consultant/shared-types';

export class CreateRegressionCaseDto {
  @IsString()
  name!: string;

  @IsString()
  userMessage!: string;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @IsObject()
  assertions?: PromptRegressionAssertions;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRegressionCaseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  userMessage?: string;

  @IsOptional()
  @IsUUID()
  sourceId?: string | null;

  @IsOptional()
  @IsObject()
  assertions?: PromptRegressionAssertions;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RunRegressionDto {
  @IsUUID()
  sourceId!: string;

  @IsString()
  clientPrompt!: string;
}

export class RegressionAssertionsDto implements PromptRegressionAssertions {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mustContain?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mustNotContain?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  minLength?: number;
}

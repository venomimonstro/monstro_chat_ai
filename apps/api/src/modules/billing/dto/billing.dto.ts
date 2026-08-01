import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { OveragePolicy } from '@ai-consultant/shared-types';

export class CreateTariffDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  period!: 'month' | 'year';

  @IsOptional()
  @IsString()
  currency?: string;

  @IsInt()
  @Min(1)
  messageLimit!: number;

  @IsInt()
  @Min(1)
  sourceLimit!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  kbLimitMb?: number;

  @IsOptional()
  @IsEnum(['block', 'charge', 'allow'])
  overagePolicy?: OveragePolicy;

  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTariffDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  period?: 'month' | 'year';

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  messageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  sourceLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  kbLimitMb?: number;

  @IsOptional()
  @IsEnum(['block', 'charge', 'allow'])
  overagePolicy?: OveragePolicy;

  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';
import { SourceStatus, SourceType } from '@prisma/client';

export class CreateSourceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsEnum(SourceType)
  type?: SourceType;
}

export class UpdateSourceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(SourceStatus)
  status?: SourceStatus;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai?: Record<string, unknown>;
}

export class WidgetPingDto {
  @IsString()
  widgetKey!: string;

  @IsOptional()
  @IsString()
  pageUrl?: string;
}

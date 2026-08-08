import { IsString, IsUUID, IsEnum, IsOptional, IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { PromptScope } from '@prisma/client';

export class CreatePromptDto {
  @IsEnum(PromptScope)
  scope!: PromptScope;

  @IsString()
  content!: string;
}

export class HistoryMessageDto {
  @IsString()
  role!: 'user' | 'assistant';

  @IsString()
  content!: string;
}

export class PlaygroundTestDto {
  @IsUUID()
  sourceId!: string;

  @IsString()
  message!: string;

  @IsString()
  clientPrompt!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoryMessageDto)
  history?: HistoryMessageDto[];
}

export class CreateExperimentDto {
  @IsString()
  name!: string;

  @IsUUID()
  promptAId!: string;

  @IsUUID()
  promptBId!: string;

  @IsOptional()
  trafficBPercent?: number;

  @IsOptional()
  minSampleSize?: number;
}

export class GeneratePromptFromUrlsDto {
  @IsUUID()
  sourceId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  urls!: string[];
}

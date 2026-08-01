import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { LeadDeliveryChannelType } from '@ai-consultant/shared-types';

export class CreateLeadDeliveryChannelDto {
  @IsIn(['telegram', 'email', 'google_sheets', 'amocrm', 'bitrix24'])
  type!: LeadDeliveryChannelType;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  botToken?: string;
}

export class UpdateLeadDeliveryChannelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  botToken?: string;
}

export class ValidateTelegramDto {
  @IsString()
  @MinLength(10)
  botToken!: string;

  @IsOptional()
  @IsString()
  chatId?: string;
}

export class EmailRecipientsDto {
  @IsArray()
  @IsString({ each: true })
  recipients!: string[];
}

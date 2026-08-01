import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, Matches, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { IntegrationStatus } from '@ai-consultant/shared-types';

export class ConversionEventsDto {
  @IsOptional()
  @IsBoolean()
  leadCreated?: boolean;

  @IsOptional()
  @IsBoolean()
  dealWon?: boolean;
}

export class UpsertMetrikaIntegrationDto {
  @IsString()
  @Matches(/^\d+$/, { message: 'Номер счётчика должен содержать только цифры' })
  counterId!: string;

  @IsOptional()
  @IsString()
  oauthToken?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: IntegrationStatus;

  @IsOptional()
  events?: ConversionEventsDto;

  @IsOptional()
  @IsString({ each: true })
  dealWonStatusNames?: string[];

  @IsOptional()
  @IsObject()
  eventMapping?: Record<string, string>;
}

export class UpsertGtmIntegrationDto {
  @IsString()
  @Matches(/^GTM-[A-Z0-9]+$/i, {
    message: 'ID контейнера должен быть в формате GTM-XXXX',
  })
  containerId!: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: IntegrationStatus;
}

export class UpsertGa4IntegrationDto {
  @IsString()
  @MinLength(3)
  measurementId!: string;

  @IsString()
  @MinLength(3)
  apiSecret!: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: IntegrationStatus;

  @IsOptional()
  events?: ConversionEventsDto;

  @IsOptional()
  @IsString({ each: true })
  dealWonStatusNames?: string[];

  @IsOptional()
  @IsObject()
  eventMapping?: Record<string, string>;
}

export class FieldMappingItemDto {
  @IsString()
  internalField!: string;

  @IsString()
  externalField!: string;
}

export class SaveFieldMappingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMappingItemDto)
  mappings!: FieldMappingItemDto[];
}

export class StatusMappingRowDto {
  @IsString()
  internalStatusId!: string;

  @IsString()
  externalStatusId!: string;
}

export class SaveStatusMappingDto {
  @IsBoolean()
  bidirectionalSync!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusMappingRowDto)
  mappings!: StatusMappingRowDto[];
}

export class CrmInboundWebhookDto {
  @IsString()
  externalId!: string;

  @IsString()
  externalStatusId!: string;

  @IsString()
  updatedAt!: string;
}

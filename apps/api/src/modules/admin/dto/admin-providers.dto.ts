import { IsArray, IsBoolean, IsOptional, IsString, ArrayMinSize, IsUUID, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProvidersDto {
  @IsArray()
  @IsString({ each: true })
  chain!: string[];

  @IsArray()
  @IsString({ each: true })
  disabled!: string[];
}

export class BulkBlockTenantsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  tenantIds!: string[];

  @IsString()
  reason!: string;
}

export class ToggleProviderDto {
  @IsBoolean()
  enabled!: boolean;
}

export class SetProviderCredentialsDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(8)
  apiKey!: string;
}

export class TestProviderCredentialsDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(8)
  apiKey?: string;
}

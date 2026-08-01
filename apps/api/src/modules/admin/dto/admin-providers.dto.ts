import { IsArray, IsBoolean, IsString, ArrayMinSize, IsUUID } from 'class-validator';

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

import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSiteSettingsDto {
  @IsOptional()
  @IsString()
  demoWidgetKey?: string;

  @IsOptional()
  @IsBoolean()
  chatEnabled?: boolean;

  @IsOptional()
  @IsString()
  welcomeTitle?: string;

  @IsOptional()
  @IsString()
  welcomeText?: string;
}

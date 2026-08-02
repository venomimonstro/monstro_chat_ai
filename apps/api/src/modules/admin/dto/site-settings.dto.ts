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

  @IsOptional()
  @IsString()
  customHeadHtml?: string;

  @IsOptional()
  @IsString()
  customBodyStartHtml?: string;

  @IsOptional()
  @IsString()
  customBodyEndHtml?: string;
}

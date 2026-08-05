import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class WidgetAttributionDto {
  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmMedium?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  utmContent?: string;

  @IsOptional()
  @IsString()
  utmTerm?: string;

  @IsOptional()
  @IsString()
  referrer?: string;

  @IsOptional()
  @IsString()
  landingPage?: string;
}

export class WidgetFunnelEventDto {
  @IsString()
  widgetKey!: string;

  @IsString()
  visitorId!: string;

  @IsString()
  eventType!: 'widget_open';

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WidgetAttributionDto)
  attribution?: WidgetAttributionDto;
}

import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import type { MessageFeedbackRating } from '@ai-consultant/shared-types';

export class WidgetFeedbackDto {
  @IsString()
  widgetKey!: string;

  @IsString()
  visitorId!: string;

  @IsUUID()
  messageId!: string;

  @IsEnum(['up', 'down'])
  rating!: MessageFeedbackRating;
}

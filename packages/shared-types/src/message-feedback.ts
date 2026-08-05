export type MessageFeedbackRating = 'up' | 'down';

export interface WidgetFeedbackRequest {
  widgetKey: string;
  visitorId: string;
  messageId: string;
  rating: MessageFeedbackRating;
}

export interface MessageFeedbackDto {
  id: string;
  messageId: string;
  dialogId: string;
  sourceId: string | null;
  rating: MessageFeedbackRating;
  createdAt: string;
}

export interface BadAnswerDto {
  id: string;
  messageId: string;
  dialogId: string;
  sourceId: string | null;
  sourceName: string | null;
  visitorId: string;
  userQuestion: string | null;
  assistantAnswer: string;
  createdAt: string;
}

export interface QualityStatsDto {
  up: number;
  down: number;
  total: number;
  satisfactionRate: number | null;
}

export interface BadAnswersListResponse {
  items: BadAnswerDto[];
  nextCursor: string | null;
}

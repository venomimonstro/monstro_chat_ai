import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { MessageFeedbackRating } from '@ai-consultant/shared-types';

@Injectable()
export class MessageFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submitFromWidget(params: {
    widgetKey: string;
    visitorId: string;
    messageId: string;
    rating: MessageFeedbackRating;
  }) {
    const source = await this.prisma.source.findUnique({
      where: { widgetKey: params.widgetKey },
    });
    if (!source || source.status !== 'active') {
      throw new NotFoundException('Виджет не найден');
    }

    const message = await this.prisma.message.findFirst({
      where: {
        id: params.messageId,
        tenantId: source.tenantId,
        role: 'assistant',
      },
      include: { dialog: { select: { visitorId: true, sourceId: true } } },
    });
    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }
    if (
      message.dialog.visitorId !== params.visitorId ||
      message.dialog.sourceId !== source.id
    ) {
      throw new ForbiddenException('Недостаточно прав для оценки');
    }

    const feedback = await this.prisma.messageFeedback.upsert({
      where: { messageId: params.messageId },
      create: {
        tenantId: source.tenantId,
        messageId: params.messageId,
        dialogId: message.dialogId,
        sourceId: source.id,
        rating: params.rating,
      },
      update: { rating: params.rating },
    });

    return {
      id: feedback.id,
      messageId: feedback.messageId,
      dialogId: feedback.dialogId,
      sourceId: feedback.sourceId,
      rating: feedback.rating,
      createdAt: feedback.createdAt.toISOString(),
    };
  }
}

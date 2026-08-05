import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessageFeedbackService } from './message-feedback.service';

describe('MessageFeedbackService', () => {
  const mockPrisma = {
    source: { findUnique: jest.fn() },
    message: { findFirst: jest.fn() },
    messageFeedback: { upsert: jest.fn() },
  };

  let service: MessageFeedbackService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MessageFeedbackService(mockPrisma as never);
  });

  it('rejects inactive widget', async () => {
    mockPrisma.source.findUnique.mockResolvedValue(null);
    await expect(
      service.submitFromWidget({
        widgetKey: 'wk',
        visitorId: 'v1',
        messageId: 'm1',
        rating: 'up',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects visitor mismatch', async () => {
    mockPrisma.source.findUnique.mockResolvedValue({
      id: 's1',
      tenantId: 't1',
      status: 'active',
    });
    mockPrisma.message.findFirst.mockResolvedValue({
      dialogId: 'd1',
      dialog: { visitorId: 'other', sourceId: 's1' },
    });

    await expect(
      service.submitFromWidget({
        widgetKey: 'wk',
        visitorId: 'v1',
        messageId: 'm1',
        rating: 'down',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('upserts feedback for valid request', async () => {
    mockPrisma.source.findUnique.mockResolvedValue({
      id: 's1',
      tenantId: 't1',
      status: 'active',
    });
    mockPrisma.message.findFirst.mockResolvedValue({
      dialogId: 'd1',
      dialog: { visitorId: 'v1', sourceId: 's1' },
    });
    mockPrisma.messageFeedback.upsert.mockResolvedValue({
      id: 'f1',
      messageId: 'm1',
      dialogId: 'd1',
      sourceId: 's1',
      rating: 'up',
      createdAt: new Date('2026-08-06T12:00:00Z'),
    });

    const result = await service.submitFromWidget({
      widgetKey: 'wk',
      visitorId: 'v1',
      messageId: 'm1',
      rating: 'up',
    });

    expect(result.rating).toBe('up');
    expect(mockPrisma.messageFeedback.upsert).toHaveBeenCalled();
  });
});

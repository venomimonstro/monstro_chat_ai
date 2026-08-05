import { ChatFunnelService } from './chat-funnel.service';

describe('ChatFunnelService', () => {
  const mockPrisma = {
    source: { findUnique: jest.fn() },
    chatFunnelEvent: {
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
    dialog: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const mockCache = { invalidateTenant: jest.fn() };

  let service: ChatFunnelService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatFunnelService(mockPrisma as never, mockCache as never);
  });

  it('deduplicates widget_open within one hour', async () => {
    mockPrisma.source.findUnique.mockResolvedValue({
      id: 's1',
      tenantId: 't1',
      status: 'active',
    });
    mockPrisma.chatFunnelEvent.findFirst.mockResolvedValue({ id: 'e1' });

    const result = await service.trackWidgetOpen({
      widgetKey: 'wk',
      visitorId: 'v1',
    });

    expect(result.recorded).toBe(false);
    expect(mockPrisma.chatFunnelEvent.create).not.toHaveBeenCalled();
  });

  it('records widget_open when no recent event', async () => {
    mockPrisma.source.findUnique.mockResolvedValue({
      id: 's1',
      tenantId: 't1',
      status: 'active',
    });
    mockPrisma.chatFunnelEvent.findFirst.mockResolvedValue(null);
    mockPrisma.chatFunnelEvent.create.mockResolvedValue({ id: 'e1' });

    const result = await service.trackWidgetOpen({
      widgetKey: 'wk',
      visitorId: 'v1',
      attribution: { utmSource: 'google' },
    });

    expect(result.recorded).toBe(true);
    expect(mockPrisma.chatFunnelEvent.create).toHaveBeenCalled();
  });

  it('builds chat funnel stages from counts', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        { event_type: 'widget_open', count: 100n },
        { event_type: 'first_message', count: 40n },
        { event_type: 'contact_shared', count: 10n },
        { event_type: 'lead_created', count: 8n },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.getChatFunnel(
      't1',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );

    expect(result.stages).toHaveLength(4);
    expect(result.stages[0].count).toBe(100);
    expect(result.stages[1].count).toBe(40);
    expect(result.stages[0].rateFromTop).toBe(100);
    expect(result.stages[1].rateFromTop).toBe(40);
  });
});

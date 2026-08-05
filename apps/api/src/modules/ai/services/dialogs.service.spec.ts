import { NotFoundException } from '@nestjs/common';
import { DialogsService } from './dialogs.service';

describe('DialogsService', () => {
  const mockPrisma = {
    dialog: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
    },
  };

  let service: DialogsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DialogsService(mockPrisma as never);
  });

  it('lists dialogs with pagination cursor', async () => {
    mockPrisma.dialog.findMany.mockResolvedValue([
      {
        id: 'd1',
        sourceId: 's1',
        visitorId: 'v1',
        status: 'active',
        startedAt: new Date('2026-08-01T10:00:00Z'),
        updatedAt: new Date('2026-08-01T11:00:00Z'),
        endedAt: null,
        source: { id: 's1', name: 'Site' },
        lead: null,
        messages: [{ content: 'Привет', role: 'user', createdAt: new Date() }],
        _count: { messages: 3 },
      },
      {
        id: 'd2',
        sourceId: 's1',
        visitorId: 'v2',
        status: 'closed',
        startedAt: new Date(),
        updatedAt: new Date(),
        endedAt: new Date(),
        source: { id: 's1', name: 'Site' },
        lead: { id: 'l1', name: 'Иван', phone: '+7999' },
        messages: [],
        _count: { messages: 0 },
      },
    ]);
    mockPrisma.dialog.groupBy.mockResolvedValue([
      { visitorId: 'v1', _count: { _all: 2 } },
      { visitorId: 'v2', _count: { _all: 1 } },
    ]);

    const result = await service.listDialogs('t1', { limit: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe('d1');
    expect(result.items[0].visitorDialogCount).toBe(2);
  });

  it('returns transcript without system dedup markers', async () => {
    mockPrisma.dialog.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId: 't1',
      sourceId: 's1',
      visitorId: 'v1',
      status: 'active',
      summary: null,
      startedAt: new Date(),
      updatedAt: new Date(),
      endedAt: null,
      referrer: null,
      landingPage: null,
      source: { id: 's1', name: 'Site' },
      lead: null,
      _count: { messages: 2 },
    });
    mockPrisma.dialog.count.mockResolvedValue(0);
    mockPrisma.message.findMany.mockResolvedValue([
      {
        id: 'm1',
        role: 'user',
        content: 'Здравствуйте',
        createdAt: new Date(),
        provider: null,
        model: null,
      },
    ]);

    const messages = await service.getTranscript('t1', 'd1');
    expect(messages).toHaveLength(1);
    expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { content: { startsWith: '__DEDUP_LINK__:' } },
        }),
      }),
    );
  });

  it('throws when dialog missing', async () => {
    mockPrisma.dialog.findFirst.mockResolvedValue(null);
    await expect(service.getDialog('t1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});

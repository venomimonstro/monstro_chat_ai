import { ConfigService } from '@nestjs/config';
import { DialogService } from './dialog.service';

describe('DialogService', () => {
  const mockPrisma = {
    dialog: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockWebhook = { deliver: jest.fn() };
  const mockAnalytics = { invalidateTenant: jest.fn() };
  const mockConfig = { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService;

  let service: DialogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DialogService(
      mockPrisma as never,
      mockWebhook as never,
      mockAnalytics as never,
      mockConfig,
    );
  });

  it('resolves effective dialog from dedup marker', async () => {
    mockPrisma.message.findFirst.mockResolvedValue({
      content: '__DEDUP_LINK__:d-target:lead-1',
    });

    const id = await service.resolveEffectiveDialogId('t1', 'd-source');
    expect(id).toBe('d-target');
  });

  it('findResumableDialog prefers active recent dialog', async () => {
    mockPrisma.dialog.findMany.mockResolvedValue([
      { id: 'd-closed', status: 'closed', updatedAt: new Date() },
      { id: 'd-active', status: 'active', updatedAt: new Date() },
    ]);
    mockPrisma.message.findFirst.mockResolvedValue(null);
    mockPrisma.dialog.findFirst.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'd-active') {
        return Promise.resolve({ id: 'd-active', status: 'active' });
      }
      if (where.id === 'd-closed') {
        return Promise.resolve({ id: 'd-closed', status: 'closed' });
      }
      return Promise.resolve(null);
    });

    const dialog = await service.findResumableDialog('t1', 's1', 'visitor-1');
    expect(dialog?.id).toBe('d-active');
  });
});

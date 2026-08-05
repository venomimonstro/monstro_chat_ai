import { ConfigService } from '@nestjs/config';
import { LeadDedupService } from './lead-dedup.service';

describe('LeadDedupService', () => {
  const mockPrisma = {
    lead: {
      findFirst: jest.fn(),
    },
    dialog: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    message: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockGateway = { emitNewLead: jest.fn() };
  const mockAnalytics = { invalidateTenant: jest.fn() };
  const mockConfig = { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService;

  let service: LeadDedupService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LeadDedupService(
      mockPrisma as never,
      mockGateway as never,
      mockAnalytics as never,
      mockConfig,
    );
  });

  it('finds duplicate by phone', async () => {
    mockPrisma.lead.findFirst.mockResolvedValue({ id: 'l1' });
    const lead = await service.findByPhone('t1', '+79991234567', 'd2');
    expect(lead?.id).toBe('l1');
    expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ phone: '+79991234567' }),
      }),
    );
  });

  it('finds lead by returning visitor', async () => {
    mockPrisma.dialog.findFirst.mockResolvedValue({
      lead: { id: 'l-old', dialogId: 'd-old' },
    });
    const lead = await service.findByVisitor('t1', 'visitor-1', 'd-new');
    expect(lead?.id).toBe('l-old');
  });

  it('links dialog messages to existing lead', async () => {
    mockPrisma.lead.findFirst.mockResolvedValue({
      id: 'l1',
      dialogId: 'd-main',
      name: null,
      phone: '+79991234567',
      email: null,
      tags: [],
      notes: null,
    });
    mockPrisma.dialog.findFirst.mockResolvedValue({ id: 'd-new' });
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        message: {
          updateMany: jest.fn().mockResolvedValue({ count: 3 }),
          create: jest.fn(),
        },
        lead: { update: jest.fn() },
        dialog: { update: jest.fn() },
      };
      return fn(tx);
    });

    const result = await service.linkDialogToLead({
      tenantId: 't1',
      sourceDialogId: 'd-new',
      targetLeadId: 'l1',
      reason: 'phone',
      contact: { name: 'Иван' },
    });

    expect(result.linked).toBe(true);
    expect(result.leadId).toBe('l1');
    expect(result.targetDialogId).toBe('d-main');
    expect(mockGateway.emitNewLead).toHaveBeenCalled();
  });

  it('resolves effective dialog from dedup marker', async () => {
    mockPrisma.message.findFirst.mockResolvedValue({
      content: '__DEDUP_LINK__:d-main:lead-1',
    });

    const result = await service.resolveEffectiveDialog('t1', 'd-closed');

    expect(result.dialogId).toBe('d-main');
    expect(result.leadId).toBe('lead-1');
  });
});

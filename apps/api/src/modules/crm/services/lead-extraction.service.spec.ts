import { LeadExtractionService } from './lead-extraction.service';
import { LeadDedupService } from './lead-dedup.service';
import { NerService } from './ner.service';
import { LlmNerService } from './llm-ner.service';
import { PipelinesService } from './pipelines.service';
import { ConversionTrackingService } from '../../integrations/services/conversion-tracking.service';
import { LeadDeliveryQueueService } from '../../integrations/lead-delivery/lead-delivery-queue.service';

describe('LeadExtractionService', () => {
  const mockPrisma = {
    dialog: {
      findUnique: jest.fn(),
    },
    lead: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    leadStatusHistory: {
      create: jest.fn(),
    },
  };

  const mockPipelines = {
    getDefaultStatus: jest.fn(),
  };

  const mockConversion = {
    trackLeadCreated: jest.fn(),
  } as unknown as ConversionTrackingService;

  const mockLeadDelivery = {
    enqueueForLead: jest.fn(),
  } as unknown as LeadDeliveryQueueService;

  const mockOutgoingWebhook = { deliver: jest.fn() };
  const mockNotifications = {
    create: jest.fn().mockResolvedValue({ id: 'n1', type: 'lead.created' }),
  };
  const mockCrmGateway = {
    emitNewLead: jest.fn(),
    emitNotification: jest.fn(),
  };
  const mockPromptExperiments = { markConverted: jest.fn() };
  const mockPush = { notifyTenant: jest.fn() };
  const mockAnalyticsCache = { invalidateTenant: jest.fn() };
  const mockDedup = {
    resolveEffectiveDialog: jest
      .fn()
      .mockImplementation(async (_t: string, id: string) => ({ dialogId: id })),
    findByVisitor: jest.fn().mockResolvedValue(null),
    findByPhone: jest.fn().mockResolvedValue(null),
    linkDialogToLead: jest.fn(),
  } as unknown as LeadDedupService;

  let service: LeadExtractionService;
  let llmNer: LlmNerService;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockDedup.resolveEffectiveDialog as jest.Mock).mockImplementation(
      async (_t: string, id: string) => ({ dialogId: id }),
    );
    (mockDedup.findByVisitor as jest.Mock).mockResolvedValue(null);
    (mockDedup.findByPhone as jest.Mock).mockResolvedValue(null);
    (mockDedup.linkDialogToLead as jest.Mock).mockReset();
    mockPipelines.getDefaultStatus.mockResolvedValue({
      id: 'status-1',
      pipelineId: 'pipeline-1',
    });
    mockPrisma.dialog.findUnique.mockResolvedValue({
      utmJson: { utm_source: 'test', utm_campaign: 'demo' },
      referrer: 'https://example.com',
      landingPage: 'https://example.com/landing',
      yandexClientId: 'ym-1',
      gaClientId: 'ga-1',
    });
    mockPrisma.message.count.mockResolvedValue(2);
    mockPrisma.message.findMany.mockResolvedValue([]);
    const ner = new NerService();
    llmNer = new LlmNerService(ner);
    service = new LeadExtractionService(
      mockPrisma as never,
      ner,
      llmNer,
      mockDedup,
      mockPipelines as unknown as PipelinesService,
      mockConversion,
      mockLeadDelivery,
      mockOutgoingWebhook as never,
      mockNotifications as never,
      mockCrmGateway as never,
      mockPromptExperiments as never,
      mockPush as never,
      mockAnalyticsCache as never,
    );
  });

  it('links duplicate phone to existing lead instead of creating', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    mockPrisma.message.findMany.mockResolvedValue([]);
    (mockDedup.findByPhone as jest.Mock).mockResolvedValue({
      id: 'lead-dup',
      dialogId: 'd-old',
    });
    (mockDedup.linkDialogToLead as jest.Mock).mockResolvedValue({
      linked: true,
      leadId: 'lead-dup',
      targetDialogId: 'd-old',
      reason: 'phone',
    });
    mockPrisma.lead.update.mockResolvedValue({});

    const result = await service.processMessage({
      tenantId: 't1',
      sourceId: 's1',
      dialogId: 'd-new',
      content: '+79991234567',
      sourceConfig: { ai: { leadExtraction: { enabled: true } } } as never,
    });

    expect(result.created).toBe(false);
    expect(result.linked).toBe(true);
    expect(result.linkedReason).toBe('phone');
    expect(mockDedup.linkDialogToLead).toHaveBeenCalled();
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it('does not create duplicate lead for same dialog', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
    mockPrisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      name: null,
      phone: '+79991234567',
      email: null,
      tags: [],
      notes: null,
    });

    const result = await service.processMessage({
      tenantId: 't1',
      sourceId: 's1',
      dialogId: 'd1',
      content: '+79991234567',
      sourceConfig: { ai: { leadExtraction: { enabled: true } } } as never,
    });

    expect(result.created).toBe(false);
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it('creates lead when phone found', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    mockPrisma.lead.findFirst.mockResolvedValue(null);
    mockPrisma.message.findMany.mockResolvedValue([]);
    mockPrisma.lead.create.mockResolvedValue({ id: 'lead-new' });

    const result = await service.processMessage({
      tenantId: 't1',
      sourceId: 's1',
      dialogId: 'd1',
      content: 'Мой телефон +79991234567',
      sourceConfig: { ai: { leadExtraction: { enabled: true } } } as never,
    });

    expect(result.created).toBe(true);
    expect(mockPrisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dialogId: 'd1',
          phone: '+79991234567',
          pipelineId: 'pipeline-1',
          statusId: 'status-1',
          yandexClientId: 'ym-1',
        }),
      }),
    );
    expect(mockConversion.trackLeadCreated).toHaveBeenCalledWith('t1', 'lead-new');
    expect(mockLeadDelivery.enqueueForLead).toHaveBeenCalledWith('t1', 'lead-new');
    expect(mockPrisma.leadStatusHistory.create).toHaveBeenCalled();
  });

  it('creates partial lead when only phone present in phone_name mode', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    mockPrisma.lead.findFirst.mockResolvedValue(null);
    mockPrisma.message.findMany.mockResolvedValue([]);
    mockPrisma.lead.create.mockResolvedValue({ id: 'lead-partial' });

    const result = await service.processMessage({
      tenantId: 't1',
      sourceId: 's1',
      dialogId: 'd1',
      content: 'телефон +79991234567',
      sourceConfig: {
        ai: {
          leadExtraction: {
            enabled: true,
            profileMode: 'phone_name',
            allowPartial: true,
          },
        },
      } as never,
    });

    expect(result.created).toBe(true);
    expect(result.partial).toBe(true);
    expect(mockPrisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: '+79991234567',
          tags: ['partial'],
        }),
      }),
    );
  });

  it('enriches existing partial lead with name', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      phone: '+79991234567',
      name: null,
      email: null,
      tags: ['partial'],
      notes: 'Частичный лид: дозаполнить поля из диалога',
    });
    mockPrisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      phone: '+79991234567',
      name: null,
      email: null,
      tags: ['partial'],
      notes: 'Частичный лид: дозаполнить поля из диалога',
    });
    mockPrisma.message.findMany.mockResolvedValue([
      { content: '+79991234567' },
      { content: 'Меня зовут Иван' },
    ]);
    mockPrisma.lead.update.mockResolvedValue({});

    const result = await service.processMessage({
      tenantId: 't1',
      sourceId: 's1',
      dialogId: 'd1',
      content: 'Меня зовут Иван',
      sourceConfig: {
        ai: {
          leadExtraction: { enabled: true, profileMode: 'phone_name' },
        },
      } as never,
    });

    expect(result.created).toBe(false);
    expect(result.updated).toBe(true);
    expect(mockPrisma.lead.update).toHaveBeenCalled();
  });

  it('defers contact ask on first turn without intent', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    mockPrisma.message.count.mockResolvedValue(1);
    mockPrisma.message.findMany.mockResolvedValue([]);

    const state = await service.getLeadState({
      tenantId: 't1',
      dialogId: 'd1',
      lastUserMessage: 'Здравствуйте',
      sourceConfig: {
        ai: { leadExtraction: { enabled: true, askAfterTurns: 2 } },
      } as never,
    });

    expect(state.askNow).toBe(false);
    expect(state.instruction).toContain('НЕ запрашивай контакт');
  });

  it('asks for contact when intent detected', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    mockPrisma.message.count.mockResolvedValue(1);
    mockPrisma.message.findMany.mockResolvedValue([]);

    const state = await service.getLeadState({
      tenantId: 't1',
      dialogId: 'd1',
      lastUserMessage: 'Сколько стоит тариф?',
      sourceConfig: {
        ai: { leadExtraction: { enabled: true, askAfterTurns: 2 } },
      } as never,
    });

    expect(state.askNow).toBe(true);
    expect(state.instruction).toContain('---contact---');
  });
});

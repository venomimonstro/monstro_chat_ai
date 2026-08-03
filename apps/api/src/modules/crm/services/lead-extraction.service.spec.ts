import { ConfigService } from '@nestjs/config';
import { LeadExtractionService } from './lead-extraction.service';
import { NerService } from './ner.service';
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
    },
    message: {
      findMany: jest.fn(),
    },
    leadStatusHistory: {
      create: jest.fn(),
    },
  };

  const mockPipelines = {
    getDefaultStatus: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue(30),
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

  let service: LeadExtractionService;

  beforeEach(() => {
    jest.clearAllMocks();
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
    service = new LeadExtractionService(
      mockPrisma as never,
      new NerService(),
      mockPipelines as unknown as PipelinesService,
      mockConversion,
      mockLeadDelivery,
      mockOutgoingWebhook as never,
      mockNotifications as never,
      mockCrmGateway as never,
      mockPromptExperiments as never,
      mockPush as never,
      mockAnalyticsCache as never,
      mockConfig as unknown as ConfigService,
    );
  });

  it('does not create duplicate lead for same dialog', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });

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
});

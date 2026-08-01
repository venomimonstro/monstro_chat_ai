import { ConfigService } from '@nestjs/config';
import { ConversionTrackingService } from './conversion-tracking.service';
import { IntegrationType } from '@prisma/client';

describe('ConversionTrackingService', () => {
  const mockFetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
  const mockPrisma = {
    lead: { findFirst: jest.fn() },
    integration: { findMany: jest.fn() },
  };
  const mockConfig = {
    get: jest.fn((key: string) => (key === 'CONVERSION_FETCH' ? mockFetch : undefined)),
  } as unknown as ConfigService;

  let service: ConversionTrackingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConversionTrackingService(mockPrisma as never, mockConfig);
  });

  it('sends Yandex offline conversion with ClientID on deal_won', async () => {
    mockPrisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      yandexClientId: 'ym-12345',
      gaClientId: null,
      phone: '+79991234567',
      email: null,
    });
    mockPrisma.integration.findMany.mockResolvedValue([
      {
        type: IntegrationType.metrika,
        configJson: {
          counterId: '87654321',
          oauthToken: 'test-token',
          events: { leadCreated: true, dealWon: true },
        },
      },
    ]);

    await service.trackDealWon('tenant-1', 'lead-1');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/counter/87654321/offline_conversions/upload');
    expect(init.headers.Authorization).toBe('OAuth test-token');
    expect(init.body).toContain('ym-12345');
    expect(init.body).toContain('deal_won');
  });

  it('does not send event when deal_won is disabled', async () => {
    mockPrisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      yandexClientId: 'ym-12345',
      gaClientId: null,
      phone: null,
      email: null,
    });
    mockPrisma.integration.findMany.mockResolvedValue([
      {
        type: IntegrationType.metrika,
        configJson: {
          counterId: '87654321',
          oauthToken: 'test-token',
          events: { leadCreated: true, dealWon: false },
        },
      },
    ]);

    await service.trackDealWon('tenant-1', 'lead-1');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('recognizes deal won status names', () => {
    expect(service.isDealWonStatus('Продажа')).toBe(true);
    expect(service.isDealWonStatus('Закрыт')).toBe(true);
    expect(service.isDealWonStatus('Новый')).toBe(false);
  });
});

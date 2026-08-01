import { ConfigService } from '@nestjs/config';
import { IntegrationType, WebhookLogStatus } from '@prisma/client';
import { CrmExportService } from './crm-export.service';
import { CredentialCryptoService } from './credential-crypto.service';
import { CrmFieldMappingService } from './crm-field-mapping.service';

describe('CrmExportService', () => {
  const mockFetch = jest.fn();
  const mockPrisma = {
    lead: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    integration: {
      findUnique: jest.fn(),
    },
    webhookLog: {
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  const mockCrypto = {
    decrypt: jest.fn().mockReturnValue(
      JSON.stringify({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 3600000,
        accountDomain: 'test.amocrm.ru',
        mock: true,
      }),
    ),
  } as unknown as CredentialCryptoService;

  const mockFieldMapping = {
    resolveMap: jest.fn().mockResolvedValue({
      name: 'name',
      phone: 'PHONE',
      email: 'EMAIL',
      notes: 'notes',
      utm_source: 'UTM_SOURCE',
      utm_campaign: 'UTM_CAMPAIGN',
      referrer: 'REFERRER',
      landing_page: 'LANDING_PAGE',
    }),
  } as unknown as CrmFieldMappingService;

  const mockConfig = {
    get: jest.fn((key: string) =>
      key === 'CRM_HTTP_FETCH' ? mockFetch : undefined,
    ),
  } as unknown as ConfigService;

  let service: CrmExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CrmExportService(
      mockPrisma as never,
      mockCrypto,
      mockFieldMapping,
      mockConfig,
    );
    mockPrisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      tenantId: 't1',
      name: 'Иван',
      phone: '+79991234567',
      email: 'a@b.c',
      notes: null,
      utmJson: { utm_source: 'google' },
      referrer: null,
      landingPage: null,
      yandexClientId: null,
      gaClientId: null,
    });
    mockPrisma.integration.findUnique.mockResolvedValue({
      id: 'int-1',
      type: IntegrationType.amocrm,
      status: 'active',
      credentialsEncrypted: 'enc',
    });
    mockPrisma.webhookLog.create.mockResolvedValue({ id: 'log-1' });
  });

  it('exports lead in mock mode without blocking on HTTP', async () => {
    await service.exportLead({
      tenantId: 't1',
      leadId: 'lead-1',
      integrationType: IntegrationType.amocrm,
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockPrisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          syncStatus: 'synced',
          externalCrmType: IntegrationType.amocrm,
        }),
      }),
    );
  });

  it('records failed webhook log and rethrows on API error', async () => {
    (mockCrypto.decrypt as jest.Mock).mockReturnValue(
      JSON.stringify({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 3600000,
        accountDomain: 'test.amocrm.ru',
        mock: false,
      }),
    );
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'error' });

    await expect(
      service.exportLead({
        tenantId: 't1',
        leadId: 'lead-1',
        integrationType: IntegrationType.amocrm,
      }),
    ).rejects.toThrow('amoCRM API 500');

    expect(mockPrisma.webhookLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: WebhookLogStatus.failed }),
      }),
    );
  });

  it('marks lead as failed after dead letter', async () => {
    await service.markLeadFailed('lead-1', 'sync failed');
    expect(mockPrisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: expect.objectContaining({ syncStatus: 'failed', syncError: 'sync failed' }),
    });
  });
});

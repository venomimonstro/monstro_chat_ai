import { SourcesService } from '../modules/sources/sources.service';
import { LeadsService } from '../modules/crm/services/leads.service';

describe('Tenant isolation', () => {
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  describe('SourcesService', () => {
    const mockPrisma = {
      source: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    let service: SourcesService;

    beforeEach(() => {
      jest.clearAllMocks();
      service = new SourcesService(mockPrisma as never);
    });

    it('scopes findAll to the requesting tenant only', async () => {
      mockPrisma.source.findMany.mockResolvedValue([]);
      await service.findAll(tenantA);
      expect(mockPrisma.source.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: tenantA }),
        }),
      );
      expect(mockPrisma.source.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: tenantB }),
        }),
      );
    });
  });

  describe('LeadsService', () => {
    const mockPrisma = {
      lead: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const mockConfig = {
      get: jest.fn().mockReturnValue(30),
    };

    let service: LeadsService;

    beforeEach(() => {
      jest.clearAllMocks();
      service = new LeadsService(
        mockPrisma as never,
        {} as never,
        { findByVisitor: jest.fn() } as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        mockConfig as never,
      );
    });

    it('scopes findAll queries to tenantId', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      await service.findAll(tenantA, {});
      expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: tenantA }),
        }),
      );
    });

    it('requires matching tenantId in findOne', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);
      await expect(service.findOne(tenantA, 'lead-x')).rejects.toThrow(
        'Лид не найден',
      );
      expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'lead-x', tenantId: tenantA }),
        }),
      );
    });
  });
});

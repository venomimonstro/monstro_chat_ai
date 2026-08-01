import { BadRequestException } from '@nestjs/common';
import { SystemUpdatesService } from './system-updates.service';

describe('SystemUpdatesService', () => {
  const mockPrisma = {
    systemUpdate: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const mockBackups = { create: jest.fn() };
  const mockRunner = {};
  const mockGateway = { emitStatus: jest.fn(), emitLog: jest.fn(), emitCanary: jest.fn() };
  const mockQueue = { add: jest.fn() };

  let service: SystemUpdatesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SystemUpdatesService(
      mockPrisma as never,
      mockBackups as never,
      mockRunner as never,
      mockGateway as never,
      mockQueue as never,
    );
    mockPrisma.systemUpdate.findUnique.mockResolvedValue({
      id: 'u1',
      version: '1.0.0',
      status: 'pending',
      imageTag: '1.0.0',
      deployLogJson: [],
    });
  });

  it('blocks production deploy before staging test', async () => {
    mockPrisma.systemUpdate.findUnique.mockResolvedValue({
      id: 'u1',
      version: '1.0.0',
      status: 'pending',
      deployLogJson: [],
    });

    await expect(service.enqueueProductionDeploy('u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

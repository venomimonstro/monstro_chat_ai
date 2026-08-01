import { ConflictException } from '@nestjs/common';
import { PipelinesService } from './pipelines.service';

describe('PipelinesService', () => {
  const mockPrisma = {
    pipeline: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    pipelineStatus: {
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    lead: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: PipelinesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PipelinesService(mockPrisma as never);
  });

  it('deleteStatus throws 409 when active leads exist', async () => {
    mockPrisma.pipelineStatus.findFirst.mockResolvedValue({
      id: 'status-1',
      pipelineId: 'pipeline-1',
    });
    mockPrisma.lead.count.mockResolvedValue(3);

    await expect(service.deleteStatus('t1', 'status-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(mockPrisma.pipelineStatus.delete).not.toHaveBeenCalled();
  });

  it('deleteStatus succeeds when no active leads', async () => {
    mockPrisma.pipelineStatus.findFirst.mockResolvedValue({
      id: 'status-1',
      pipelineId: 'pipeline-1',
    });
    mockPrisma.lead.count.mockResolvedValue(0);

    const result = await service.deleteStatus('t1', 'status-1');

    expect(result).toEqual({ success: true });
    expect(mockPrisma.pipelineStatus.delete).toHaveBeenCalledWith({
      where: { id: 'status-1' },
    });
  });
});

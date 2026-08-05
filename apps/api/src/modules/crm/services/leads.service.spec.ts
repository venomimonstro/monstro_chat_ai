import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadsService } from './leads.service';
import { PipelinesService } from './pipelines.service';
import { EmailService } from '../../../common/email/email.service';
import { CrmGateway } from '../crm.gateway';

describe('LeadsService', () => {
  const mockPrisma = {
    lead: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    message: {
      updateMany: jest.fn(),
    },
    leadStatusHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    pipelineStatus: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockPipelines = {} as PipelinesService;
  const mockEmail = { sendLeadAssignment: jest.fn() } as unknown as EmailService;
  const mockGateway = { emitLeadAssigned: jest.fn() } as unknown as CrmGateway;
  const mockConversion = {
    trackDealWon: jest.fn(),
    isDealWonStatus: jest.fn().mockReturnValue(false),
  };
  const mockStatusSyncQueue = {
    enqueueStatusPush: jest.fn().mockResolvedValue(undefined),
  };
  const mockConfig = { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService;
  const mockDedup = {
    findByVisitor: jest.fn().mockResolvedValue(null),
  };

  let service: LeadsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LeadsService(
      mockPrisma as never,
      mockPipelines,
      mockDedup as never,
      mockEmail,
      mockGateway,
      mockConversion as never,
      mockStatusSyncQueue as never,
      mockConfig,
    );
  });

  it('merge archives source and moves messages to target dialog', async () => {
    const source = {
      id: 'lead-src',
      tenantId: 't1',
      dialogId: 'dialog-src',
      archived: false,
      phone: '+79991234567',
      name: 'Иван',
      email: null,
      notes: null,
    };
    const target = {
      id: 'lead-tgt',
      tenantId: 't1',
      dialogId: 'dialog-tgt',
      archived: false,
      phone: null,
      name: null,
      email: null,
    };

    mockPrisma.lead.findFirst
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce({
        ...target,
        phone: '+79991234567',
        name: 'Иван',
        tags: [],
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: null,
        assignedUser: null,
        source: null,
      });

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<void>) => {
      await fn(mockPrisma);
    });

    const result = await service.merge('t1', 'lead-src', 'lead-tgt');

    expect(mockPrisma.message.updateMany).toHaveBeenCalledWith({
      where: { dialogId: 'dialog-src', tenantId: 't1' },
      data: { dialogId: 'dialog-tgt' },
    });
    expect(mockPrisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-src' },
        data: expect.objectContaining({ archived: true, mergedIntoId: 'lead-tgt' }),
      }),
    );
    expect(result.id).toBe('lead-tgt');
  });

  it('updateStatus records history entry', async () => {
    mockPrisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      tenantId: 't1',
      statusId: 'status-old',
      pipelineId: 'pipeline-1',
      archived: false,
    });
    mockPrisma.pipelineStatus.findFirst.mockResolvedValue({
      id: 'status-new',
      pipelineId: 'pipeline-1',
    });
    mockPrisma.lead.update.mockResolvedValue({
      id: 'lead-1',
      tenantId: 't1',
      dialogId: 'd1',
      sourceId: null,
      pipelineId: 'pipeline-1',
      statusId: 'status-new',
      assignedUserId: null,
      mergedIntoId: null,
      name: null,
      phone: null,
      email: null,
      tags: [],
      notes: null,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: {
        id: 'status-new',
        pipelineId: 'pipeline-1',
        name: 'В работе',
        sortOrder: 1,
        color: '#f59e0b',
      },
      assignedUser: null,
      source: null,
    });

    await service.updateStatus('t1', 'lead-1', 'status-new', 'user-1');

    expect(mockPrisma.leadStatusHistory.create).toHaveBeenCalledWith({
      data: {
        tenantId: 't1',
        leadId: 'lead-1',
        fromStatusId: 'status-old',
        toStatusId: 'status-new',
        changedById: 'user-1',
      },
    });
  });

  it('merge rejects same lead ids', async () => {
    await expect(service.merge('t1', 'lead-1', 'lead-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('archiveMany archives leads for tenant', async () => {
    mockPrisma.lead.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.archiveMany('t1', ['lead-1', 'lead-2']);

    expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 't1',
        id: { in: ['lead-1', 'lead-2'] },
        archived: false,
      },
      data: { archived: true },
    });
    expect(result).toEqual({ archived: 2 });
  });

  it('archiveMany returns zero for empty ids', async () => {
    const result = await service.archiveMany('t1', []);
    expect(mockPrisma.lead.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ archived: 0 });
  });
});

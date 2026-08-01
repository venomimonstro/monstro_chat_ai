import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IntegrationType } from '@prisma/client';
import { QUEUE_CRM_STATUS_SYNC } from '../constants';
import type { CrmStatusPushPayload } from './crm-status-sync.service';

@Injectable()
export class CrmStatusSyncQueueService {
  private readonly logger = new Logger(CrmStatusSyncQueueService.name);

  constructor(
    @InjectQueue(QUEUE_CRM_STATUS_SYNC)
    private readonly statusQueue: Queue,
  ) {}

  async enqueueStatusPush(
    tenantId: string,
    leadId: string,
    statusId: string,
  ) {
    const payload: CrmStatusPushPayload = { tenantId, leadId, statusId };
    await this.statusQueue.add('push-status', payload, {
      jobId: `${leadId}:status:${statusId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 200,
      removeOnFail: 100,
    });
    this.logger.log(`Queued status push for lead ${leadId}`);
  }
}

export type { CrmStatusPushPayload };

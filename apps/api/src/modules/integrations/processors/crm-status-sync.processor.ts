import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_CRM_STATUS_SYNC } from '../constants';
import {
  CrmStatusSyncService,
  type CrmStatusPushPayload,
} from '../services/crm-status-sync.service';

@Processor(QUEUE_CRM_STATUS_SYNC, { concurrency: 3 })
export class CrmStatusSyncProcessor extends WorkerHost {
  constructor(private readonly statusSync: CrmStatusSyncService) {
    super();
  }

  async process(job: Job<CrmStatusPushPayload>) {
    await this.statusSync.pushStatusOutbound(job.data);
  }
}

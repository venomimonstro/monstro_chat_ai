import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_LEAD_DELIVERY } from '../../constants';
import { LeadDeliveryService } from '../lead-delivery.service';
import type { LeadDeliveryJobPayload } from '../lead-delivery.types';

@Processor(QUEUE_LEAD_DELIVERY, { concurrency: 5 })
export class LeadDeliveryProcessor extends WorkerHost {
  constructor(private readonly delivery: LeadDeliveryService) {
    super();
  }

  async process(job: Job<LeadDeliveryJobPayload>) {
    const { tenantId, leadId, channelId, test } = job.data;
    await this.delivery.processDelivery(
      tenantId,
      leadId,
      channelId,
      test ?? false,
    );
  }
}

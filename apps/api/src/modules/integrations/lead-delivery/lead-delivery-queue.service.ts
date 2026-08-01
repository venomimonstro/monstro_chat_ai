import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  LEAD_DELIVERY_MAX_ATTEMPTS,
  QUEUE_LEAD_DELIVERY,
} from '../constants';
import type { LeadDeliveryJobPayload } from './lead-delivery.types';

@Injectable()
export class LeadDeliveryQueueService {
  private readonly logger = new Logger(LeadDeliveryQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_LEAD_DELIVERY) private readonly queue: Queue,
  ) {}

  async enqueueForLead(tenantId: string, leadId: string) {
    const channels = await this.prisma.leadDeliveryChannel.findMany({
      where: { tenantId, enabled: true },
    });
    if (!channels.length) return;

    for (const channel of channels) {
      const payload: LeadDeliveryJobPayload = {
        tenantId,
        leadId,
        channelId: channel.id,
      };
      await this.queue.add('deliver-lead', payload, {
        jobId: `${leadId}:${channel.id}`,
        attempts: LEAD_DELIVERY_MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      });
      this.logger.log(
        `Queued lead delivery ${leadId} → ${channel.type} (${channel.id})`,
      );
    }
  }

  async enqueueTest(tenantId: string, channelId: string) {
    const payload: LeadDeliveryJobPayload = {
      tenantId,
      leadId: 'test',
      channelId,
      test: true,
    };
    await this.queue.add('deliver-lead', payload, {
      jobId: `test:${channelId}:${Date.now()}`,
      attempts: 1,
      removeOnComplete: 50,
      removeOnFail: 50,
    });
  }
}

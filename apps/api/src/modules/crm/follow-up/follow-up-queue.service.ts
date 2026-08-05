import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_FOLLOW_UP } from './constants';
import type { FollowUpJobPayload } from './follow-up.types';

@Injectable()
export class FollowUpQueueService {
  private readonly logger = new Logger(FollowUpQueueService.name);

  constructor(@InjectQueue(QUEUE_FOLLOW_UP) private readonly queue: Queue) {}

  async enqueue(payload: FollowUpJobPayload) {
    await this.queue.add('send-follow-up', payload, {
      jobId: `follow-up:${payload.dialogId}:${payload.attemptIndex}:${Date.now()}`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    this.logger.debug(`Queued follow-up for dialog ${payload.dialogId}`);
  }
}

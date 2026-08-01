import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_SYSTEM_UPDATES } from '../constants';
import {
  SystemUpdatesService,
  type SystemUpdateJobPayload,
} from '../services/system-updates.service';

@Processor(QUEUE_SYSTEM_UPDATES, { concurrency: 1 })
export class SystemUpdateProcessor extends WorkerHost {
  constructor(private readonly updates: SystemUpdatesService) {
    super();
  }

  async process(job: Job<SystemUpdateJobPayload>) {
    await this.updates.processJob(job.data);
  }
}

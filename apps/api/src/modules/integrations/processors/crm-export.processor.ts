import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_CRM_EXPORT } from '../constants';
import { CrmExportService, type CrmExportPayload } from '../services/crm-export.service';

@Processor(QUEUE_CRM_EXPORT, { concurrency: 3 })
export class CrmExportProcessor extends WorkerHost {
  private readonly logger = new Logger(CrmExportProcessor.name);

  constructor(private readonly exportService: CrmExportService) {
    super();
  }

  async process(job: Job<CrmExportPayload>) {
    await this.exportService.exportLead(job.data);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<CrmExportPayload> | undefined, error: Error) {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= attempts) {
      await this.exportService.markLeadFailed(
        job.data.leadId,
        error.message.slice(0, 500),
      );
      this.logger.error(
        `CRM export dead-letter for lead ${job.data.leadId}: ${error.message}`,
      );
    }
  }
}

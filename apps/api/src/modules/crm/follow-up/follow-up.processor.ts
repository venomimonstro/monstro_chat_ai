import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FOLLOW_UP_JOB_CONCURRENCY, QUEUE_FOLLOW_UP } from './constants';
import type { FollowUpJobPayload } from './follow-up.types';
import { FollowUpEligibilityService } from './follow-up-eligibility.service';
import { FollowUpOrchestratorService } from './follow-up-orchestrator.service';
import { FollowUpPushService } from './follow-up-push.service';
import { FollowUpSchedulerService } from './follow-up-scheduler.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
@Processor(QUEUE_FOLLOW_UP, { concurrency: FOLLOW_UP_JOB_CONCURRENCY })
export class FollowUpProcessor extends WorkerHost {
  private readonly logger = new Logger(FollowUpProcessor.name);

  constructor(
    private readonly eligibility: FollowUpEligibilityService,
    private readonly orchestrator: FollowUpOrchestratorService,
    private readonly push: FollowUpPushService,
    private readonly scheduler: FollowUpSchedulerService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<FollowUpJobPayload>) {
    const { dialogId, tenantId, sourceId, visitorId } = job.data;

    const check = await this.eligibility.isEligible(dialogId);
    if (!check.eligible || !check.dialog || !check.sourceConfig) {
      this.logger.debug(`Follow-up skipped ${dialogId}: ${check.reason ?? 'unknown'}`);
      return;
    }

    const result = await this.orchestrator.generateFollowUp({
      dialogId,
      tenantId,
      sourceId,
      sourceConfig: check.sourceConfig,
      attemptIndex: check.dialog.followUpCount,
    });

    if (!result) {
      await this.prisma.dialog.update({
        where: { id: dialogId },
        data: { nextFollowUpAt: null },
      });
      return;
    }

    const newCount = check.dialog.followUpCount + 1;
    await this.prisma.dialog.update({
      where: { id: dialogId },
      data: { followUpCount: newCount },
    });

    const pushed = this.push.push({
      dialogId,
      visitorId,
      messageId: result.messageId,
      content: result.content,
      createdAt: new Date().toISOString(),
    });

    if (!pushed) {
      this.logger.debug(`Follow-up saved but visitor ${visitorId} offline`);
    }

    await this.scheduler.scheduleNextAttempt({
      dialogId,
      followUpCount: newCount,
      sourceConfig: check.sourceConfig,
    });
  }
}

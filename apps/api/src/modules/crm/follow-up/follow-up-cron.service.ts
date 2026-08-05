import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { FollowUpEligibilityService } from './follow-up-eligibility.service';
import { FollowUpQueueService } from './follow-up-queue.service';

@Injectable()
export class FollowUpCronService {
  private readonly logger = new Logger(FollowUpCronService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: FollowUpEligibilityService,
    private readonly queue: FollowUpQueueService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async scanDueFollowUps() {
    if (this.running) return;
    this.running = true;

    try {
      const dialogIds = await this.eligibility.findDueDialogs(40);
      for (const dialogId of dialogIds) {
        const check = await this.eligibility.isEligible(dialogId);
        if (!check.eligible || !check.dialog) continue;

        await this.queue.enqueue({
          dialogId: check.dialog.id,
          tenantId: check.dialog.tenantId,
          sourceId: check.dialog.sourceId,
          visitorId: check.dialog.visitorId,
          attemptIndex: check.dialog.followUpCount,
        });

        await this.prisma.dialog.update({
          where: { id: dialogId },
          data: {
            nextFollowUpAt: new Date(Date.now() + 60_000),
          },
        });
      }

      if (dialogIds.length) {
        this.logger.log(`Enqueued ${dialogIds.length} follow-up scan batch`);
      }
    } catch (error) {
      this.logger.error(`Follow-up cron failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}

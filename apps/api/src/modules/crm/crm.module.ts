import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { CrmController } from './crm.controller';
import { PipelinesController } from './pipelines.controller';
import { LeadsController } from './leads.controller';
import { CrmService } from './crm.service';
import { NerService } from './services/ner.service';
import { LlmNerService } from './services/llm-ner.service';
import { LeadDedupService } from './services/lead-dedup.service';
import { LeadExtractionService } from './services/lead-extraction.service';
import { PipelinesService } from './services/pipelines.service';
import { LeadsService } from './services/leads.service';
import { CrmGateway } from './crm.gateway';
import { EmailModule } from '../../common/email/email.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushModule } from '../push/push.module';
import { PromptExperimentModule } from '../prompts/prompt-experiment.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AiModule } from '../ai/ai.module';
import { BillingModule } from '../billing/billing.module';
import { QUEUE_FOLLOW_UP } from './follow-up/constants';
import { FollowUpPushService } from './follow-up/follow-up-push.service';
import { FollowUpSchedulerService } from './follow-up/follow-up-scheduler.service';
import { FollowUpEligibilityService } from './follow-up/follow-up-eligibility.service';
import { FollowUpOrchestratorService } from './follow-up/follow-up-orchestrator.service';
import { FollowUpQueueService } from './follow-up/follow-up-queue.service';
import { FollowUpProcessor } from './follow-up/follow-up.processor';
import { FollowUpCronService } from './follow-up/follow-up-cron.service';

@Module({
  imports: [
    JwtModule.register({}),
    EmailModule,
    IntegrationsModule,
    NotificationsModule,
    PushModule,
    PromptExperimentModule,
    AnalyticsModule,
    BillingModule,
    BullModule.registerQueue({ name: QUEUE_FOLLOW_UP }),
    forwardRef(() => AiModule),
  ],
  controllers: [CrmController, PipelinesController, LeadsController],
  providers: [
    CrmService,
    NerService,
    LlmNerService,
    LeadDedupService,
    LeadExtractionService,
    PipelinesService,
    LeadsService,
    CrmGateway,
    FollowUpPushService,
    FollowUpSchedulerService,
    FollowUpEligibilityService,
    FollowUpOrchestratorService,
    FollowUpQueueService,
    FollowUpProcessor,
    FollowUpCronService,
  ],
  exports: [
    LeadDedupService,
    LeadExtractionService,
    NerService,
    LlmNerService,
    LeadsService,
    PipelinesService,
    CrmGateway,
    FollowUpPushService,
    FollowUpSchedulerService,
  ],
})
export class CrmModule {}

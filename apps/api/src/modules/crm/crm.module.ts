import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CrmController } from './crm.controller';
import { PipelinesController } from './pipelines.controller';
import { LeadsController } from './leads.controller';
import { CrmService } from './crm.service';
import { NerService } from './services/ner.service';
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

@Module({
  imports: [JwtModule.register({}), EmailModule, IntegrationsModule, NotificationsModule, PushModule, PromptExperimentModule, AnalyticsModule],
  controllers: [CrmController, PipelinesController, LeadsController],
  providers: [
    CrmService,
    NerService,
    LeadExtractionService,
    PipelinesService,
    LeadsService,
    CrmGateway,
  ],
  exports: [
    LeadExtractionService,
    NerService,
    LeadsService,
    PipelinesService,
    CrmGateway,
  ],
})
export class CrmModule {}

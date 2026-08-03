import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailModule } from '../../common/email/email.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { ConversionTrackingService } from './services/conversion-tracking.service';
import { CredentialCryptoService } from './services/credential-crypto.service';
import { CrmOAuthService } from './services/crm-oauth.service';
import { CrmFieldMappingService } from './services/crm-field-mapping.service';
import { CrmExportService } from './services/crm-export.service';
import { CrmSyncService } from './services/crm-sync.service';
import { CrmExportProcessor } from './processors/crm-export.processor';
import { CrmSyncLockService } from './services/crm-sync-lock.service';
import { CrmStatusMappingService } from './services/crm-status-mapping.service';
import { CrmStatusSyncService } from './services/crm-status-sync.service';
import { CrmStatusSyncQueueService } from './services/crm-status-sync-queue.service';
import { CrmStatusSyncProcessor } from './processors/crm-status-sync.processor';
import { LeadDeliveryController } from './lead-delivery/lead-delivery.controller';
import { LeadDeliveryService } from './lead-delivery/lead-delivery.service';
import { LeadDeliveryQueueService } from './lead-delivery/lead-delivery-queue.service';
import { CrmChannelProvisionerService } from './lead-delivery/crm-channel-provisioner.service';
import { LeadDeliveryRegistryService } from './lead-delivery/lead-delivery-registry.service';
import { LeadDeliveryProcessor } from './lead-delivery/processors/lead-delivery.processor';
import { GoogleSheetsOAuthService } from './lead-delivery/google-sheets-oauth.service';
import { TelegramDeliveryAdapter } from './lead-delivery/adapters/telegram.adapter';
import { EmailDeliveryAdapter } from './lead-delivery/adapters/email.adapter';
import { GoogleSheetsDeliveryAdapter } from './lead-delivery/adapters/google-sheets.adapter';
import { AmocrmDeliveryAdapter } from './lead-delivery/adapters/amocrm-delivery.adapter';
import { Bitrix24DeliveryAdapter } from './lead-delivery/adapters/bitrix24-delivery.adapter';
import {
  QUEUE_CRM_EXPORT,
  QUEUE_CRM_STATUS_SYNC,
  QUEUE_LEAD_DELIVERY,
} from './constants';
import { OutgoingWebhookController } from './outgoing-webhook/outgoing-webhook.controller';
import { OutgoingWebhookService } from './outgoing-webhook/outgoing-webhook.service';

@Module({
  imports: [
    EmailModule,
    BullModule.registerQueue(
      { name: QUEUE_CRM_EXPORT },
      { name: QUEUE_CRM_STATUS_SYNC },
      { name: QUEUE_LEAD_DELIVERY },
    ),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    IntegrationsController,
    LeadDeliveryController,
    OutgoingWebhookController,
  ],
  providers: [
    IntegrationsService,
    ConversionTrackingService,
    CredentialCryptoService,
    CrmOAuthService,
    CrmFieldMappingService,
    CrmExportService,
    CrmSyncService,
    CrmExportProcessor,
    CrmSyncLockService,
    CrmStatusMappingService,
    CrmStatusSyncService,
    CrmStatusSyncQueueService,
    CrmStatusSyncProcessor,
    LeadDeliveryService,
    LeadDeliveryQueueService,
    CrmChannelProvisionerService,
    LeadDeliveryRegistryService,
    LeadDeliveryProcessor,
    GoogleSheetsOAuthService,
    TelegramDeliveryAdapter,
    EmailDeliveryAdapter,
    GoogleSheetsDeliveryAdapter,
    AmocrmDeliveryAdapter,
    Bitrix24DeliveryAdapter,
    OutgoingWebhookService,
  ],
  exports: [
    IntegrationsService,
    ConversionTrackingService,
    CredentialCryptoService,
    CrmSyncService,
    CrmStatusSyncQueueService,
    LeadDeliveryQueueService,
    OutgoingWebhookService,
  ],
})
export class IntegrationsModule {}

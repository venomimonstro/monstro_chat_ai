import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { TariffsService } from './services/tariffs.service';
import { TariffResolverService } from './services/tariff-resolver.service';
import { SubscriptionService } from './services/subscription.service';
import { UsageLimitService } from './services/usage-limit.service';
import { BillingCronService } from './services/billing-cron.service';
import { YooKassaFactoryService } from './services/yookassa-factory.service';
import { CheckoutService } from './services/checkout.service';
import { WebhookService } from './services/webhook.service';
import { WebhookVerificationService } from './services/webhook-verification.service';
import { RenewalService } from './services/renewal.service';
import { EmailModule } from '../../common/email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EmailModule, NotificationsModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    TariffsService,
    TariffResolverService,
    SubscriptionService,
    UsageLimitService,
    BillingCronService,
    YooKassaFactoryService,
    CheckoutService,
    WebhookService,
    WebhookVerificationService,
    RenewalService,
  ],
  exports: [
    UsageLimitService,
    TariffResolverService,
    TariffsService,
    CheckoutService,
    WebhookService,
    WebhookVerificationService,
    RenewalService,
  ],
})
export class BillingModule {}

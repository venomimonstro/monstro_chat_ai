import { Injectable } from '@nestjs/common';
import { TariffsService } from './services/tariffs.service';
import { SubscriptionService } from './services/subscription.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly tariffs: TariffsService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  listTariffs() {
    return this.tariffs.listActive();
  }

  getOverview(tenantId: string) {
    return this.subscriptions.getOverview(tenantId);
  }
}

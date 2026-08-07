import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CurrencyEnum } from '@webzaytsev/yookassa-ts-sdk';
import { PrismaService } from '../../../prisma/prisma.service';
import { YooKassaFactoryService } from './yookassa-factory.service';

@Injectable()
export class RenewalService {
  private readonly logger = new Logger(RenewalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yooKassaFactory: YooKassaFactoryService,
  ) {}

  async renewSubscriptionsExpiringWithin(days: number) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + days);

    const subs = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        paymentMethodId: { not: null },
        currentPeriodEnd: { lte: deadline },
      },
      include: { tariff: true, tenant: true },
    });

    for (const sub of subs) {
      try {
        await this.renewSubscription(sub);
      } catch (error) {
        this.logger.error(
          `Renewal failed for tenant ${sub.tenantId}: ${String(error)}`,
        );
      }
    }
  }

  private async renewSubscription(sub: {
    id: string;
    tenantId: string;
    tariffId: string;
    paymentMethodId: string | null;
    currentPeriodEnd: Date | null;
    tariff: { name: string; price: Prisma.Decimal; currency: string; period: string };
  }) {
    const client = this.yooKassaFactory.getClient();
    if (!client || !sub.paymentMethodId) {
      this.logger.warn(`Cannot renew ${sub.id}: no payment method or SDK`);
      return;
    }

    const pendingRenewal = await this.prisma.payment.findFirst({
      where: {
        tenantId: sub.tenantId,
        status: 'pending',
        metadataJson: {
          path: ['renewal'],
          equals: true,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (pendingRenewal) {
      this.logger.log(
        `Subscription ${sub.id} already has pending renewal ${pendingRenewal.id} — skipping`,
      );
      return;
    }

    const payment = await this.prisma.payment.create({
      data: {
        tenantId: sub.tenantId,
        amount: sub.tariff.price,
        currency: sub.tariff.currency,
        description: `Автопродление ${sub.tariff.name}`,
        status: 'pending',
        metadataJson: {
          tariffId: sub.tariffId,
          subscriptionId: sub.id,
          renewal: true,
        } as Prisma.InputJsonValue,
      },
    });

    const idempotenceKey = payment.id;

    try {
      const yooPayment = await client.payments.create(
        {
          amount: {
            value: Number(sub.tariff.price).toFixed(2),
            currency: sub.tariff.currency as CurrencyEnum,
          },
          capture: true,
          payment_method_id: sub.paymentMethodId,
          description: `Автопродление ${sub.tariff.name}`,
          metadata: {
            aicw_payment_id: payment.id,
            tenant_id: sub.tenantId,
            tariff_id: sub.tariffId,
            subscription_id: sub.id,
          },
          receipt: {
            customer: { email: 'client@example.com' },
            items: [
              {
                description: `Автопродление ${sub.tariff.name}`,
                quantity: 1,
                amount: {
                  value: Number(sub.tariff.price).toFixed(2),
                  currency: sub.tariff.currency as CurrencyEnum,
                },
                vat_code: 1,
                payment_subject: 'service',
                payment_mode: 'full_payment',
              },
            ],
          },
        },
        idempotenceKey,
      );

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { yooKassaPaymentId: yooPayment.id },
      });

      this.logger.log(
        `Renewal payment created for subscription ${sub.id}: ${yooPayment.id}`,
      );
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'canceled' },
      });
      this.logger.error(
        `Renewal payment failed for subscription ${sub.id}: ${String(error)}`,
      );
    }
  }
}

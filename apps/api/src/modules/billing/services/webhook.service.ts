import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { YooKassaFactoryService } from './yookassa-factory.service';

interface YooKassaWebhookPayload {
  event: string;
  object: {
    id: string;
    status: string;
    amount: { value: string; currency: string };
    payment_method?: { id: string };
    metadata?: { aicw_payment_id?: string; tenant_id?: string; tariff_id?: string };
    receipt_registration?: { status: string; id: string };
    description?: string;
  };
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yooKassaFactory: YooKassaFactoryService,
  ) {}

  async handle(payload: YooKassaWebhookPayload): Promise<{ received: true }> {
    const object = payload.object;
    const yooPaymentId = object.id;

    if (!yooPaymentId) {
      return { received: true };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { yooKassaPaymentId: yooPaymentId },
      include: { tenant: true },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for yookassa id ${yooPaymentId}`);
      return { received: true };
    }

    const metadata = object.metadata ?? {};
    const tenantId = payment.tenantId;
    const tariffId =
      (payment.metadataJson as { tariffId?: string })?.tariffId ??
      metadata.tariff_id;

    // Idempotency: terminal statuses never regress.
    const terminalStatuses = ['succeeded', 'refunded', 'canceled'];
    if (terminalStatuses.includes(payment.status)) {
      this.logger.log(
        `Payment ${payment.id} already terminal (${payment.status}) — ignoring ${payload.event}`,
      );
      return { received: true };
    }

    const eventHandlers: Record<string, () => Promise<void>> = {
      'payment.succeeded': async () =>
        this.activatePayment(
          payment.id,
          tenantId,
          tariffId ?? null,
          object.payment_method?.id ?? null,
          object,
        ),
      'payment.canceled': async () =>
        this.cancelPayment(payment.id, tenantId),
      'refund.succeeded': async () => this.refundPayment(payment.id, tenantId, object),
    };

    const handler = eventHandlers[payload.event];
    if (handler) {
      await handler();
    }

    return { received: true };
  }

  private async activatePayment(
    paymentId: string,
    tenantId: string,
    tariffId: string | null,
    paymentMethodId: string | null,
    yooObject: YooKassaWebhookPayload['object'],
  ) {
    const tariff = tariffId
      ? await this.prisma.tariff.findUnique({ where: { id: tariffId } })
      : null;

    const periodMonths = tariff?.period === 'year' ? 12 : 1;
    const now = new Date();
    const periodEnd = new Date(
      now.getFullYear(),
      now.getMonth() + periodMonths,
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
    );

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: paymentId, status: 'pending' },
        data: { status: 'succeeded', paymentMethodId },
      });

      if (updated.count === 0) {
        this.logger.log(`Payment ${paymentId} already succeeded or not pending`);
        return;
      }

      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) return;

      const existingActive = await tx.subscription.findFirst({
        where: { tenantId, status: 'active' },
      });

      if (existingActive) {
        await tx.subscription.update({
          where: { id: existingActive.id },
          data: {
            tariffId: tariffId ?? undefined,
            currentPeriodEnd: periodEnd,
            paymentMethodId,
          },
        });
      } else {
        await tx.subscription.create({
          data: {
            tenantId,
            tariffId: tariffId ?? (await this.getDefaultTariffId()),
            status: 'active',
            currentPeriodEnd: periodEnd,
            paymentMethodId,
          },
        });
      }

      await tx.tenant.update({
        where: { id: tenantId },
        data: { status: 'active', tariffId: tariffId ?? undefined },
      });

      await tx.transaction.create({
        data: {
          tenant: { connect: { id: tenantId } },
          payment: payment.id ? { connect: { id: payment.id } } : undefined,
          type: 'payment',
          amount: payment.amount,
          currency: payment.currency,
          description: `Оплата подписки ${tariff?.name ?? ''}`,
          periodStart: now,
          periodEnd,
          receiptUrl: yooObject.receipt_registration?.id
            ? `https://yookassa.ru/receipts/${yooObject.receipt_registration.id}`
            : null,
        } as Prisma.TransactionCreateInput,
      });
    });

    this.logger.log(`Payment ${paymentId} succeeded and subscription activated`);
  }

  private async cancelPayment(paymentId: string, tenantId: string) {
    const updated = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: { in: ['pending', 'succeeded'] } },
      data: { status: 'canceled' },
    });
    if (updated.count === 0) {
      this.logger.log(`Payment ${paymentId} not canceled (already terminal or missing)`);
      return;
    }
    this.logger.log(`Payment ${paymentId} canceled for tenant ${tenantId}`);
  }

  private async refundPayment(
    paymentId: string,
    tenantId: string,
    yooObject: YooKassaWebhookPayload['object'],
  ) {
    const refundAmount = yooObject.amount?.value
      ? new Prisma.Decimal(yooObject.amount.value)
      : new Prisma.Decimal(0);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: paymentId, status: { in: ['pending', 'succeeded'] } },
        data: { status: 'refunded' },
      });
      if (updated.count === 0) {
        this.logger.log(`Payment ${paymentId} not refunded (already terminal or missing)`);
        return;
      }
      await tx.transaction.create({
        data: {
          tenantId,
          paymentId,
          type: 'refund',
          amount: refundAmount,
          currency: yooObject.amount?.currency ?? 'RUB',
          description: 'Возврат платежа',
        },
      });
    });
  }

  private async getDefaultTariffId(): Promise<string> {
    const tariff = await this.prisma.tariff.findFirst({
      where: { name: 'Start', isActive: true },
    });
    if (!tariff) {
      throw new Error('Default Start tariff not found');
    }
    return tariff.id;
  }
}

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { CurrencyEnum } from '@webzaytsev/yookassa-ts-sdk';
import { PrismaService } from '../../../prisma/prisma.service';
import { YooKassaFactoryService } from './yookassa-factory.service';
import { TariffResolverService } from './tariff-resolver.service';
import type { CheckoutResponseDto } from '@ai-consultant/shared-types';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly yooKassaFactory: YooKassaFactoryService,
    private readonly tariffResolver: TariffResolverService,
    private readonly config: ConfigService,
  ) {}

  async checkout(
    tenantId: string,
    tariffId: string,
  ): Promise<CheckoutResponseDto> {
    const tariff = await this.prisma.tariff.findUnique({
      where: { id: tariffId, isActive: true },
    });
    if (!tariff) throw new NotFoundException('Тариф не найден');

    const client = this.yooKassaFactory.getClient();
    if (!client) {
      throw new BadRequestException(
        'ЮKassa не настроена: отсутствуют shop_id или secret_key',
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        amount: tariff.price,
        currency: tariff.currency,
        description: `Подписка ${tariff.name}`,
        status: 'pending',
        metadataJson: { tariffId: tariff.id } as Prisma.InputJsonValue,
      },
    });

    const returnUrl = this.config.get<string>(
      'YOOKASSA_RETURN_URL',
      'http://localhost:5173/billing/success',
    );

    const idempotenceKey = payment.id;
    try {
      const yooPayment = await client.payments.create(
        {
          amount: {
            value: Number(tariff.price).toFixed(2),
            currency: tariff.currency as CurrencyEnum,
          },
          confirmation: {
            type: 'redirect',
            return_url: `${returnUrl}?payment_id=${payment.id}`,
          },
          capture: true,
          description: `Подписка ${tariff.name}`,
          metadata: {
            aicw_payment_id: payment.id,
            tenant_id: tenantId,
            tariff_id: tariff.id,
          },
          save_payment_method: true,
          receipt: {
            customer: {
              email: (await this.getTenantEmail(tenantId)) ?? 'client@example.com',
            },
            items: [
              {
                description: `Подписка ${tariff.name}`,
                quantity: 1,
                amount: {
                  value: Number(tariff.price).toFixed(2),
                  currency: tariff.currency as CurrencyEnum,
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

      const confirmationUrl =
        yooPayment.confirmation && 'confirmation_url' in yooPayment.confirmation
          ? (yooPayment.confirmation as { confirmation_url?: string })
              .confirmation_url ?? null
          : null;

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          yooKassaPaymentId: yooPayment.id,
          confirmationUrl,
        },
      });

      return {
        paymentId: payment.id,
        confirmationUrl: confirmationUrl ?? '',
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'canceled' },
      });
      throw new BadRequestException(
        `Не удалось создать платёж: ${String(error)}`,
      );
    }
  }

  async listPayments(tenantId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => ({
      id: p.id,
      yooKassaPaymentId: p.yooKassaPaymentId,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      description: p.description,
      confirmationUrl: p.confirmationUrl,
      receiptUrl: p.receiptUrl,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  private async getTenantEmail(tenantId: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { users: { where: { role: 'owner' }, take: 1 } },
    });
    return tenant?.users[0]?.email ?? null;
  }

  async listTransactions(tenantId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return transactions.map((t) => ({
      id: t.id,
      paymentId: t.paymentId,
      subscriptionId: t.subscriptionId,
      type: t.type,
      amount: Number(t.amount),
      currency: t.currency,
      description: t.description,
      periodStart: t.periodStart?.toISOString() ?? null,
      periodEnd: t.periodEnd?.toISOString() ?? null,
      receiptUrl: t.receiptUrl,
      createdAt: t.createdAt.toISOString(),
    }));
  }
}

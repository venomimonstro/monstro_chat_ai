import { Injectable, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { Tariff } from '@prisma/client';
import type { TariffDto } from '@ai-consultant/shared-types';

@Injectable()
export class TariffsService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive() {
    const tariffs = await this.prisma.tariff.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
    return tariffs.map((t) => this.toDto(t));
  }

  async listAll() {
    const tariffs = await this.prisma.tariff.findMany({
      orderBy: { price: 'asc' },
    });
    const counts = await this.prisma.subscription.groupBy({
      by: ['tariffId'],
      where: { status: { in: ['active', 'trialing'] } },
      _count: { _all: true },
    });
    const countMap = new Map(
      counts.map((row) => [row.tariffId, row._count._all]),
    );
    return tariffs.map((t) => ({
      ...this.toDto(t),
      activeSubscriptions: countMap.get(t.id) ?? 0,
    }));
  }

  async create(data: {
    name: string;
    price: number;
    period: string;
    currency?: string;
    messageLimit: number;
    sourceLimit: number;
    kbLimitMb?: number;
    overagePolicy?: 'block' | 'charge' | 'allow';
    features?: Record<string, unknown>;
    isActive?: boolean;
  }) {
    const tariff = await this.prisma.tariff.create({
      data: {
        name: data.name,
        price: data.price,
        period: data.period,
        currency: data.currency ?? 'RUB',
        messageLimit: data.messageLimit,
        sourceLimit: data.sourceLimit,
        kbLimitMb: data.kbLimitMb ?? 100,
        overagePolicy: data.overagePolicy ?? 'block',
        featuresJson: (data.features ?? {}) as Prisma.InputJsonValue,
        isActive: data.isActive ?? true,
      },
    });
    return this.toDto(tariff);
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      price: number;
      period: string;
      currency: string;
      messageLimit: number;
      sourceLimit: number;
      kbLimitMb: number;
      overagePolicy: 'block' | 'charge' | 'allow';
      features: Record<string, unknown>;
      isActive: boolean;
    }>,
  ) {
    const tariff = await this.prisma.tariff.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.period !== undefined ? { period: data.period } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.messageLimit !== undefined
          ? { messageLimit: data.messageLimit }
          : {}),
        ...(data.sourceLimit !== undefined
          ? { sourceLimit: data.sourceLimit }
          : {}),
        ...(data.kbLimitMb !== undefined ? { kbLimitMb: data.kbLimitMb } : {}),
        ...(data.overagePolicy !== undefined
          ? { overagePolicy: data.overagePolicy }
          : {}),
        ...(data.features !== undefined
          ? { featuresJson: data.features as Prisma.InputJsonValue }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    return this.toDto(tariff);
  }

  async deactivate(id: string) {
    const activeSubscriptions = await this.prisma.subscription.count({
      where: { tariffId: id, status: { in: ['active', 'trialing'] } },
    });
    if (activeSubscriptions > 0) {
      throw new ConflictException(
        'Нельзя отключить тариф с активными подписками',
      );
    }
    return this.update(id, { isActive: false });
  }

  toDto(tariff: Tariff): TariffDto {
    return {
      id: tariff.id,
      name: tariff.name,
      price: Number(tariff.price),
      period: tariff.period as 'month' | 'year',
      currency: tariff.currency,
      messageLimit: tariff.messageLimit,
      sourceLimit: tariff.sourceLimit,
      kbLimitMb: tariff.kbLimitMb,
      overagePolicy: tariff.overagePolicy,
      features: (tariff.featuresJson as Record<string, unknown>) ?? {},
      isActive: tariff.isActive,
    };
  }
}

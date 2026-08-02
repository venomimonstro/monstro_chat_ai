import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_SOURCE_CONFIG,
  mergeSourceConfig,
  patchSourceConfig,
  SourceConfig,
} from '@ai-consultant/shared-types';
import { randomBytes } from 'crypto';
import { CreateSourceDto, UpdateSourceDto } from './dto/source.dto';
import { Source, SourceStatus, Prisma } from '@prisma/client';

@Injectable()
export class SourcesService {
  constructor(private readonly prisma: PrismaService) {}

  generateWidgetKey(): string {
    return `wk_${randomBytes(24).toString('base64url')}`;
  }

  async findAll(tenantId: string) {
    const sources = await this.prisma.source.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return sources.map((s) => this.toDto(s));
  }

  async findOne(tenantId: string, id: string) {
    const source = await this.getSourceOrThrow(tenantId, id);
    return this.toDto(source);
  }

  async create(tenantId: string, dto: CreateSourceDto) {
    await this.assertSourceLimit(tenantId);

    const source = await this.prisma.source.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type ?? 'website',
        widgetKey: this.generateWidgetKey(),
        configJson: DEFAULT_SOURCE_CONFIG as unknown as Prisma.InputJsonValue,
      },
    });

    return this.toDto(source);
  }

  async update(tenantId: string, id: string, dto: UpdateSourceDto) {
    await this.getSourceOrThrow(tenantId, id);

    const updateData: Prisma.SourceUpdateInput = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.ai !== undefined) {
      const existing = await this.prisma.source.findUnique({ where: { id } });
      const merged = patchSourceConfig(
        existing?.configJson as unknown as SourceConfig,
        { ai: dto.ai as Partial<SourceConfig['ai']> },
      );
      updateData.configJson = merged as unknown as Prisma.InputJsonValue;
    }
    if (dto.config !== undefined) {
      const existing = await this.prisma.source.findUnique({ where: { id } });
      const merged = patchSourceConfig(
        existing?.configJson as unknown as SourceConfig,
        dto.config as Partial<SourceConfig>,
      );
      updateData.configJson = merged as unknown as Prisma.InputJsonValue;
      updateData.configVersion = { increment: 1 };
    }

    const source = await this.prisma.source.update({
      where: { id },
      data: updateData,
    });

    return this.toDto(source);
  }

  async remove(tenantId: string, id: string) {
    await this.getSourceOrThrow(tenantId, id);
    await this.prisma.source.delete({ where: { id } });
    return { success: true };
  }

  async clone(tenantId: string, id: string) {
    const original = await this.getSourceOrThrow(tenantId, id);
    await this.assertSourceLimit(tenantId);

    const source = await this.prisma.source.create({
      data: {
        tenantId,
        name: `${original.name} (копия)`,
        type: original.type,
        widgetKey: this.generateWidgetKey(),
        configJson: original.configJson as Prisma.InputJsonValue,
        status: 'inactive',
      },
    });

    return this.toDto(source);
  }

  async findByWidgetKey(widgetKey: string) {
    return this.prisma.source.findUnique({ where: { widgetKey } });
  }

  getAllowedOrigins(source: Source): string[] {
    const config = mergeSourceConfig(
      source.configJson as unknown as SourceConfig,
    );
    return config.security?.allowedOrigins ?? [];
  }

  async recordPing(widgetKey: string) {
    const source = await this.prisma.source.findUnique({ where: { widgetKey } });
    if (!source) throw new NotFoundException('Виджет не найден');

    const now = new Date();
    const updated = await this.prisma.source.update({
      where: { id: source.id },
      data: {
        lastSeenAt: now,
        scriptInstalledAt: source.scriptInstalledAt ?? now,
      },
    });

    return { ok: true, scriptInstalledAt: updated.scriptInstalledAt };
  }

  async getSourceLimit(tenantId: string): Promise<number> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tariff: true,
        subscriptions: {
          where: { status: { in: ['trialing', 'active'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { tariff: true },
        },
      },
    });

    const tariff =
      tenant?.subscriptions[0]?.tariff ?? tenant?.tariff ?? null;

    if (!tariff) {
      const defaultTariff = await this.prisma.tariff.findFirst({
        where: { name: 'Start', isActive: true },
      });
      return defaultTariff?.sourceLimit ?? 1;
    }

    return tariff.sourceLimit;
  }

  private async assertSourceLimit(tenantId: string) {
    const [count, limit] = await Promise.all([
      this.prisma.source.count({ where: { tenantId } }),
      this.getSourceLimit(tenantId),
    ]);

    if (count >= limit) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'LIMIT_EXCEEDED',
        message: `Достигнут лимит источников по тарифу (${limit})`,
        limit,
        current: count,
      });
    }
  }

  private async getSourceOrThrow(tenantId: string, id: string) {
    const source = await this.prisma.source.findFirst({
      where: { id, tenantId },
    });
    if (!source) throw new NotFoundException('Источник не найден');
    return source;
  }

  private toDto(source: Source) {
    return {
      id: source.id,
      tenantId: source.tenantId,
      type: source.type,
      name: source.name,
      widgetKey: source.widgetKey,
      status: source.status,
      config: mergeSourceConfig(source.configJson as unknown as SourceConfig),
      configVersion: source.configVersion,
      scriptInstalledAt: source.scriptInstalledAt?.toISOString() ?? null,
      lastSeenAt: source.lastSeenAt?.toISOString() ?? null,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    };
  }
}

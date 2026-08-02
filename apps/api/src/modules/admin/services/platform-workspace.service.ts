import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import type {
  ImpersonateResponseDto,
  PlatformWorkspaceDto,
} from '@ai-consultant/shared-types';
import { DEFAULT_SOURCE_CONFIG } from '@ai-consultant/shared-types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { SourcesService } from '../../sources/sources.service';
import { SiteSettingsService } from './site-settings.service';
import { AdminTenantsService, RequestMeta } from './admin-tenants.service';
import { AuthenticatedUser } from '../../../common/interfaces/jwt-payload.interface';

const REDIS_KEY = 'admin:platform-workspace';
const PLATFORM_TENANT_NAME = 'Платформа (публичный сайт)';
const PLATFORM_SOURCE_NAME = 'Публичный сайт';

interface StoredWorkspace {
  tenantId: string;
  ownerUserId: string;
  sourceId: string;
  widgetKey: string;
}

@Injectable()
export class PlatformWorkspaceService {
  private readonly logger = new Logger(PlatformWorkspaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sources: SourcesService,
    private readonly siteSettings: SiteSettingsService,
    private readonly adminTenants: AdminTenantsService,
    private readonly config: ConfigService,
  ) {}

  async getWorkspace(): Promise<PlatformWorkspaceDto> {
    const workspace = await this.ensureWorkspace();
    const webClientUrl = this.config.get<string>(
      'WEB_CLIENT_URL',
      'http://localhost:5173',
    );

    return {
      tenantId: workspace.tenantId,
      tenantName: PLATFORM_TENANT_NAME,
      sourceId: workspace.sourceId,
      widgetKey: workspace.widgetKey,
      webClientUrl,
    };
  }

  async openWorkspace(
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<ImpersonateResponseDto> {
    const workspace = await this.ensureWorkspace();
    return this.adminTenants.impersonate(
      workspace.tenantId,
      'Вход в ЛК платформы для обработки лидов с публичного сайта',
      actor,
      meta,
    );
  }

  private async ensureWorkspace(): Promise<StoredWorkspace> {
    const cached = await this.loadStored();
    if (cached) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: cached.tenantId },
      });
      if (tenant) return cached;
    }

    const existingTenant = await this.prisma.tenant.findFirst({
      where: { name: PLATFORM_TENANT_NAME },
      include: {
        sources: { where: { name: PLATFORM_SOURCE_NAME }, take: 1 },
        users: { where: { role: 'client' }, take: 1 },
      },
    });

    if (existingTenant?.ownerUserId && existingTenant.sources[0]) {
      const workspace: StoredWorkspace = {
        tenantId: existingTenant.id,
        ownerUserId: existingTenant.ownerUserId,
        sourceId: existingTenant.sources[0].id,
        widgetKey: existingTenant.sources[0].widgetKey,
      };
      await this.saveStored(workspace);
      await this.syncDemoWidgetKey(workspace.widgetKey);
      return workspace;
    }

    const workspace = await this.provisionWorkspace();
    await this.saveStored(workspace);
    await this.syncDemoWidgetKey(workspace.widgetKey);
    return workspace;
  }

  private async provisionWorkspace(): Promise<StoredWorkspace> {
    const trialEndsAt = new Date();
    trialEndsAt.setFullYear(trialEndsAt.getFullYear() + 10);

    const ownerEmail = `platform-workspace-${randomBytes(6).toString('hex')}@workspace.internal`;
    const passwordHash = await argon2.hash(randomBytes(24).toString('base64url'), {
      type: argon2.argon2id,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: PLATFORM_TENANT_NAME,
          status: 'active',
          trialEndsAt,
        },
      });

      const owner = await tx.user.create({
        data: {
          email: ownerEmail,
          passwordHash,
          role: 'client',
          tenantId: tenant.id,
          status: 'active',
        },
      });

      await tx.tenant.update({
        where: { id: tenant.id },
        data: { ownerUserId: owner.id },
      });

      const defaultTariff = await tx.tariff.findFirst({
        where: { isActive: true },
        orderBy: { price: 'asc' },
      });

      if (defaultTariff) {
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            tariffId: defaultTariff.id,
            status: 'active',
            currentPeriodEnd: trialEndsAt,
          },
        });
      }

      const source = await tx.source.create({
        data: {
          tenantId: tenant.id,
          name: PLATFORM_SOURCE_NAME,
          type: 'website',
          status: 'active',
          widgetKey: this.sources.generateWidgetKey(),
          configJson: DEFAULT_SOURCE_CONFIG as unknown as Prisma.InputJsonValue,
        },
      });

      return { tenant, owner, source };
    });

    this.logger.log(
      `Platform workspace provisioned: tenant=${result.tenant.id}, widgetKey=${result.source.widgetKey}`,
    );

    return {
      tenantId: result.tenant.id,
      ownerUserId: result.owner.id,
      sourceId: result.source.id,
      widgetKey: result.source.widgetKey,
    };
  }

  private async syncDemoWidgetKey(widgetKey: string): Promise<void> {
    const current = this.siteSettings.getPublicConfig();
    if (!current.demoWidgetKey?.trim()) {
      await this.siteSettings.update({ demoWidgetKey: widgetKey });
    }
  }

  private async loadStored(): Promise<StoredWorkspace | null> {
    const client = this.redis.getClient();
    if (!client) return null;
    const raw = await client.get(REDIS_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredWorkspace;
    } catch {
      return null;
    }
  }

  private async saveStored(workspace: StoredWorkspace): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;
    await client.set(REDIS_KEY, JSON.stringify(workspace));
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { StabilityComponentStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';

export interface StabilityProbeDto {
  component: string;
  label: string;
  status: StabilityComponentStatus;
  message: string | null;
  latencyMs: number | null;
  checkedAt: string;
}

export interface StabilityStatusDto {
  overall: StabilityComponentStatus;
  timestamp: string;
  probes: StabilityProbeDto[];
  openIncidents: number;
}

interface ProbeConfig {
  component: string;
  label: string;
  url: string;
  expect?: RegExp;
}

@Injectable()
export class StabilityMonitorService {
  private readonly logger = new Logger(StabilityMonitorService.name);
  private lastStatuses = new Map<string, StabilityComponentStatus>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 */2 * * *')
  async scheduledCheck(): Promise<void> {
    try {
      await this.runChecks();
    } catch (error) {
      this.logger.error(`Scheduled stability check failed: ${error}`);
    }
  }

  getProbes(): ProbeConfig[] {
    const apiBase = this.config.get<string>(
      'STABILITY_API_URL',
      'http://127.0.0.1:3000/api',
    );
    const clientUrl = this.config.get<string>(
      'STABILITY_CLIENT_URL',
      this.config.get<string>('WEB_CLIENT_URL', 'http://127.0.0.1:5173'),
    );
    const adminUrl = this.config.get<string>(
      'STABILITY_ADMIN_URL',
      this.config.get<string>('WEB_ADMIN_URL', 'http://127.0.0.1:5174'),
    );
    const publicUrl = this.config.get<string>(
      'STABILITY_PUBLIC_URL',
      this.config.get<string>('PUBLIC_SITE_URL', 'http://127.0.0.1:4321'),
    );
    const widgetUrl = this.config.get<string>(
      'STABILITY_WIDGET_URL',
      this.config.get<string>('WIDGET_URL', 'http://127.0.0.1:5175'),
    );

    return [
      {
        component: 'api',
        label: 'API',
        url: `${apiBase}/health`,
        expect: /"status":"ok"/,
      },
      {
        component: 'api_db',
        label: 'PostgreSQL',
        url: `${apiBase}/health/db`,
        expect: /"database":"connected"/,
      },
      {
        component: 'api_redis',
        label: 'Redis',
        url: `${apiBase}/health/redis`,
        expect: /"redis":"connected"/,
      },
      {
        component: 'public_chat',
        label: 'Публичный чат',
        url: `${apiBase}/public/demo-widget`,
        expect: /demoWidgetKey/,
      },
      {
        component: 'web_client',
        label: 'ЛК клиента',
        url: `${clientUrl.replace(/\/$/, '')}/health.txt`,
        expect: /^ok$/m,
      },
      {
        component: 'web_admin',
        label: 'Админка',
        url: `${adminUrl.replace(/\/$/, '')}/health.txt`,
        expect: /^ok$/m,
      },
      {
        component: 'public_site',
        label: 'Публичный сайт',
        url: publicUrl,
      },
      {
        component: 'widget_embed',
        label: 'AI-виджет',
        url: `${widgetUrl.replace(/\/$/, '')}/health.txt`,
        expect: /^ok$/m,
      },
    ];
  }

  async runChecks(): Promise<StabilityStatusDto> {
    const probes: StabilityProbeDto[] = [];
    const internal = await this.checkInternalDependencies();

    for (const probe of this.getProbes()) {
      if (probe.component === 'api_db') {
        probes.push(internal.db);
        continue;
      }
      if (probe.component === 'api_redis') {
        probes.push(internal.redis);
        continue;
      }
      probes.push(await this.checkHttpProbe(probe));
    }

    await this.persistChecks(probes);
    await this.handleIncidents(probes);

    const overall = this.computeOverall(probes);
    return {
      overall,
      timestamp: new Date().toISOString(),
      probes,
      openIncidents: await this.prisma.stabilityIncident.count({
        where: { resolvedAt: null },
      }),
    };
  }

  async getStatus(): Promise<StabilityStatusDto> {
    const latest = await this.prisma.stabilityCheck.findMany({
      orderBy: { checkedAt: 'desc' },
      take: 20,
    });

    if (!latest.length) {
      return this.runChecks();
    }

    const byComponent = new Map<string, (typeof latest)[0]>();
    for (const row of latest) {
      if (!byComponent.has(row.component)) {
        byComponent.set(row.component, row);
      }
    }

    const probes: StabilityProbeDto[] = [...byComponent.values()].map((row) => ({
      component: row.component,
      label: this.labelFor(row.component),
      status: row.status,
      message: row.message,
      latencyMs: row.latencyMs,
      checkedAt: row.checkedAt.toISOString(),
    }));

    return {
      overall: this.computeOverall(probes),
      timestamp: new Date().toISOString(),
      probes,
      openIncidents: await this.prisma.stabilityIncident.count({
        where: { resolvedAt: null },
      }),
    };
  }

  async listIncidents(limit = 30) {
    const rows = await this.prisma.stabilityIncident.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      component: row.component,
      severity: row.severity,
      message: row.message,
      autoFixAttempted: row.autoFixAttempted,
      autoFixSuccess: row.autoFixSuccess,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async checkInternalDependencies(): Promise<{
    db: StabilityProbeDto;
    redis: StabilityProbeDto;
  }> {
    const checkedAt = new Date().toISOString();
    let dbStatus: StabilityComponentStatus = 'ok';
    let dbMessage: string | null = null;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = 'down';
      dbMessage = error instanceof Error ? error.message : String(error);
    }

    const redisOk = await this.redis.ping();
    return {
      db: {
        component: 'api_db',
        label: 'PostgreSQL',
        status: dbStatus,
        message: dbMessage,
        latencyMs: null,
        checkedAt,
      },
      redis: {
        component: 'api_redis',
        label: 'Redis',
        status: redisOk ? 'ok' : 'down',
        message: redisOk ? null : 'Redis ping failed',
        latencyMs: null,
        checkedAt,
      },
    };
  }

  private async checkHttpProbe(probe: ProbeConfig): Promise<StabilityProbeDto> {
    const started = Date.now();
    const checkedAt = new Date().toISOString();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(probe.url, { signal: controller.signal });
      clearTimeout(timeout);
      const body = await res.text();
      const latencyMs = Date.now() - started;

      if (!res.ok) {
        return {
          component: probe.component,
          label: probe.label,
          status: 'down',
          message: `HTTP ${res.status}`,
          latencyMs,
          checkedAt,
        };
      }

      if (probe.expect && !probe.expect.test(body)) {
        return {
          component: probe.component,
          label: probe.label,
          status: 'degraded',
          message: 'Unexpected response',
          latencyMs,
          checkedAt,
        };
      }

      return {
        component: probe.component,
        label: probe.label,
        status: 'ok',
        message: null,
        latencyMs,
        checkedAt,
      };
    } catch (error) {
      return {
        component: probe.component,
        label: probe.label,
        status: 'down',
        message: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - started,
        checkedAt,
      };
    }
  }

  private async persistChecks(probes: StabilityProbeDto[]): Promise<void> {
    await this.prisma.stabilityCheck.createMany({
      data: probes.map((probe) => ({
        component: probe.component,
        status: probe.status,
        message: probe.message,
        latencyMs: probe.latencyMs,
      })),
    });

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await this.prisma.stabilityCheck.deleteMany({
      where: { checkedAt: { lt: cutoff } },
    });
  }

  private async handleIncidents(probes: StabilityProbeDto[]): Promise<void> {
    for (const probe of probes) {
      const prev = this.lastStatuses.get(probe.component);
      this.lastStatuses.set(probe.component, probe.status);

      if (probe.status === 'ok') {
        if (prev && prev !== 'ok') {
          await this.prisma.stabilityIncident.updateMany({
            where: { component: probe.component, resolvedAt: null },
            data: { resolvedAt: new Date() },
          });
        }
        continue;
      }

      if (prev === probe.status) continue;

      await this.prisma.stabilityIncident.create({
        data: {
          component: probe.component,
          severity: probe.status === 'down' ? 'critical' : 'warning',
          message: probe.message ?? `${probe.label} unavailable`,
        },
      });
    }
  }

  private computeOverall(probes: StabilityProbeDto[]): StabilityComponentStatus {
    if (probes.some((p) => p.status === 'down')) return 'down';
    if (probes.some((p) => p.status === 'degraded')) return 'degraded';
    return 'ok';
  }

  private labelFor(component: string): string {
    return this.getProbes().find((p) => p.component === component)?.label ?? component;
  }
}

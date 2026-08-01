import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import type { CanaryMetricsDto, DeployLogEntry, TestReportDto } from '@ai-consultant/shared-types';
import {
  CANARY_ERROR_RATE_THRESHOLD,
  CANARY_LATENCY_P95_MS_THRESHOLD,
  CANARY_MONITOR_SEC,
} from '../constants';

const execFileAsync = promisify(execFile);

export interface DeployContext {
  updateId: string;
  version: string;
  imageTag?: string | null;
  onLog: (entry: DeployLogEntry) => void | Promise<void>;
}

@Injectable()
export class DeploymentRunnerService {
  private readonly logger = new Logger(DeploymentRunnerService.name);
  private readonly healthUrl: string;
  private readonly deployMode: string;

  constructor(config: ConfigService) {
    this.healthUrl = config.get<string>(
      'DEPLOY_HEALTH_URL',
      'http://localhost:3000/api/health',
    );
    this.deployMode = config.get<string>('DEPLOY_MODE', 'mock');
  }

  async runStagingTests(ctx: DeployContext): Promise<TestReportDto> {
    const startedAt = new Date();
    await ctx.onLog({
      at: startedAt.toISOString(),
      level: 'info',
      message: `Запуск staging-тестов для ${ctx.version}`,
    });

    if (ctx.version.includes('broken')) {
      const finishedAt = new Date();
      return {
        passed: false,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        suites: [
          {
            name: 'health-check',
            passed: 0,
            failed: 1,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
          },
        ],
        error: 'Health-check failed (broken version marker)',
      };
    }

    const healthOk = await this.checkHealth(ctx);
    const e2e = await this.runE2eSuite(ctx);

    const finishedAt = new Date();
    const passed = healthOk && e2e.passed;

    return {
      passed,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      suites: [
        {
          name: 'health-check',
          passed: healthOk ? 1 : 0,
          failed: healthOk ? 0 : 1,
          durationMs: 500,
        },
        ...e2e.suites,
      ],
      error: passed ? undefined : 'Staging tests failed',
    };
  }

  async runBlueGreenDeploy(ctx: DeployContext): Promise<void> {
    await ctx.onLog({
      at: new Date().toISOString(),
      level: 'info',
      message: 'Создание green-окружения',
    });

    if (this.deployMode === 'script') {
      await execFileAsync('bash', [
        join(process.cwd(), 'scripts', 'blue-green-deploy.sh'),
        ctx.version,
        ctx.imageTag ?? ctx.version,
      ]);
    } else {
      await this.sleep(1500);
      await ctx.onLog({
        at: new Date().toISOString(),
        level: 'info',
        message: 'Green-контейнеры подняты (mock)',
      });
    }

    const healthy = await this.checkHealth(ctx);
    if (!healthy) {
      throw new Error('Health-check новой версии не пройден');
    }

    await ctx.onLog({
      at: new Date().toISOString(),
      level: 'info',
      message: 'Переключение Nginx upstream на green',
    });

    if (this.deployMode === 'mock') {
      await this.sleep(800);
    }
  }

  async runCanaryMonitor(ctx: DeployContext): Promise<CanaryMetricsDto> {
    await ctx.onLog({
      at: new Date().toISOString(),
      level: 'info',
      message: `Canary-мониторинг (${CANARY_MONITOR_SEC}s)`,
    });

    if (this.deployMode === 'mock') {
      await this.sleep(1000);
    } else {
      await this.sleep(CANARY_MONITOR_SEC * 1000);
    }

    const simulatedHighErrors = ctx.version.includes('high-errors');
    const errorRate = simulatedHighErrors ? 0.25 : 0.01;
    const latencyP95Ms = simulatedHighErrors ? 3500 : 420;
    const passed =
      errorRate <= CANARY_ERROR_RATE_THRESHOLD &&
      latencyP95Ms <= CANARY_LATENCY_P95_MS_THRESHOLD;

    return {
      errorRate,
      latencyP95Ms,
      sampleCount: 120,
      thresholdErrorRate: CANARY_ERROR_RATE_THRESHOLD,
      passed,
      checkedAt: new Date().toISOString(),
    };
  }

  async rollback(version: string, onLog: DeployContext['onLog']) {
    await onLog({
      at: new Date().toISOString(),
      level: 'warn',
      message: `Откат на версию ${version}`,
    });

    if (this.deployMode === 'script') {
      await execFileAsync('bash', [
        join(process.cwd(), 'scripts', 'rollback-version.sh'),
        version,
      ]);
    } else {
      await this.sleep(1000);
    }
  }

  private async checkHealth(ctx: DeployContext) {
    if (ctx.version.includes('broken')) {
      await ctx.onLog({
        at: new Date().toISOString(),
        level: 'error',
        message: 'Health-check: версия помечена как broken',
      });
      return false;
    }

    if (this.deployMode === 'script') {
      try {
        await execFileAsync('bash', [
          join(process.cwd(), 'scripts', 'health-check.sh'),
          this.healthUrl,
        ]);
        return true;
      } catch {
        return false;
      }
    }

    try {
      const response = await fetch(this.healthUrl);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async runE2eSuite(ctx: DeployContext) {
    if (process.env.E2E_MODE === 'skip') {
      return {
        passed: true,
        suites: [
          { name: 'e2e-smoke', passed: 0, failed: 0, durationMs: 0 },
        ],
      };
    }

    if (this.deployMode === 'script') {
      try {
        const { stdout } = await execFileAsync('npm', ['run', 'test:e2e'], {
          cwd: join(process.cwd(), 'e2e'),
          env: { ...process.env, E2E_BASE_URL: process.env.E2E_BASE_URL ?? 'http://localhost:3000' },
        });
        await ctx.onLog({
          at: new Date().toISOString(),
          level: 'info',
          message: `E2E: ${stdout.slice(0, 200)}`,
        });
        return {
          passed: true,
          suites: [{ name: 'e2e-smoke', passed: 1, failed: 0, durationMs: 1000 }],
        };
      } catch (error) {
        return {
          passed: false,
          suites: [{ name: 'e2e-smoke', passed: 0, failed: 1, durationMs: 1000 }],
        };
      }
    }

    return {
      passed: true,
      suites: [{ name: 'e2e-smoke', passed: 3, failed: 0, durationMs: 800 }],
    };
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, SystemUpdateStatus } from '@prisma/client';
import type {
  CreateSystemUpdateDto,
  DeployLogEntry,
  SystemUpdateDto,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';
import { BackupSnapshotService } from './backup-snapshot.service';
import { DeploymentRunnerService } from './deployment-runner.service';
import { UpdatesGateway } from '../gateways/updates.gateway';
import { DEPLOY_LOG_MAX, QUEUE_SYSTEM_UPDATES } from '../constants';

export type SystemUpdateJobType = 'staging_test' | 'production_deploy' | 'rollback';

export interface SystemUpdateJobPayload {
  updateId: string;
  type: SystemUpdateJobType;
  rollbackVersion?: string;
}

@Injectable()
export class SystemUpdatesService {
  private readonly logger = new Logger(SystemUpdatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly backups: BackupSnapshotService,
    private readonly runner: DeploymentRunnerService,
    private readonly updatesGateway: UpdatesGateway,
    @InjectQueue(QUEUE_SYSTEM_UPDATES)
    private readonly queue: Queue<SystemUpdateJobPayload>,
  ) {}

  async list(): Promise<SystemUpdateDto[]> {
    const rows = await this.prisma.systemUpdate.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => this.toDto(row));
  }

  async get(id: string): Promise<SystemUpdateDto> {
    const row = await this.prisma.systemUpdate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Обновление не найдено');
    return this.toDto(row);
  }

  async create(dto: CreateSystemUpdateDto): Promise<SystemUpdateDto> {
    const row = await this.prisma.systemUpdate.create({
      data: {
        version: dto.version,
        changelog: dto.changelog,
        gitSha: dto.gitSha,
        imageTag: dto.imageTag ?? dto.version,
        deployLogJson: [] as Prisma.InputJsonValue,
      },
    });
    return this.toDto(row);
  }

  async enqueueStagingTest(id: string) {
    const update = await this.requireUpdate(id);
    if (!['pending', 'test_failed'].includes(update.status)) {
      throw new BadRequestException('Тестирование недоступно для текущего статуса');
    }

    await this.prisma.systemUpdate.update({
      where: { id },
      data: { status: 'testing', testReportJson: Prisma.JsonNull },
    });
    this.updatesGateway.emitStatus(id, 'testing');

    await this.queue.add('staging-test', { updateId: id, type: 'staging_test' }, {
      jobId: `${id}:staging`,
      removeOnComplete: 50,
      removeOnFail: 20,
    });

    return this.get(id);
  }

  async enqueueProductionDeploy(id: string) {
    const update = await this.requireUpdate(id);
    if (update.status !== 'test_passed' && update.status !== 'awaiting_approval') {
      throw new BadRequestException(
        'Выкатка на прод разрешена только после успешного staging-теста',
      );
    }

    const snapshot = await this.backups.create(`pre-deploy-${update.version}`);

    await this.prisma.systemUpdate.update({
      where: { id },
      data: {
        status: 'deploying',
        backupSnapshotId: snapshot.id,
      },
    });
    this.updatesGateway.emitStatus(id, 'deploying');

    await this.queue.add(
      'production-deploy',
      { updateId: id, type: 'production_deploy' },
      { jobId: `${id}:prod`, removeOnComplete: 50, removeOnFail: 20 },
    );

    return this.get(id);
  }

  async enqueueRollback(id: string, rollbackVersion: string) {
    const update = await this.requireUpdate(id);
    await this.prisma.systemUpdate.update({
      where: { id },
      data: { status: 'deploying', rollbackVersion },
    });
    this.updatesGateway.emitStatus(id, 'rolling_back');

    await this.queue.add(
      'rollback',
      { updateId: id, type: 'rollback', rollbackVersion },
      { jobId: `${id}:rollback`, removeOnComplete: 50 },
    );

    return this.get(id);
  }

  async processJob(payload: SystemUpdateJobPayload) {
    if (payload.type === 'staging_test') {
      return this.runStagingTest(payload.updateId);
    }
    if (payload.type === 'production_deploy') {
      return this.runProductionDeploy(payload.updateId);
    }
    if (payload.type === 'rollback') {
      return this.runRollback(payload.updateId, payload.rollbackVersion!);
    }
  }

  private async runStagingTest(updateId: string) {
    const update = await this.requireUpdate(updateId);
    const report = await this.runner.runStagingTests({
      updateId,
      version: update.version,
      imageTag: update.imageTag,
      onLog: (entry) => this.appendLog(updateId, entry),
    });

    const status: SystemUpdateStatus = report.passed ? 'test_passed' : 'test_failed';
    await this.prisma.systemUpdate.update({
      where: { id: updateId },
      data: {
        status,
        testReportJson: report as unknown as Prisma.InputJsonValue,
      },
    });
    this.updatesGateway.emitStatus(updateId, status);
    return report;
  }

  private async runProductionDeploy(updateId: string) {
    const update = await this.requireUpdate(updateId);
    const ctx = {
      updateId,
      version: update.version,
      imageTag: update.imageTag,
      onLog: (entry: DeployLogEntry) => this.appendLog(updateId, entry),
    };

    try {
      await this.runner.runBlueGreenDeploy(ctx);

      await this.prisma.systemUpdate.update({
        where: { id: updateId },
        data: { status: 'canary_monitoring' },
      });
      this.updatesGateway.emitStatus(updateId, 'canary_monitoring');

      const metrics = await this.runner.runCanaryMonitor(ctx);
      this.updatesGateway.emitCanary(updateId, metrics);

      if (!metrics.passed) {
        await this.runner.rollback(update.rollbackVersion ?? 'previous', ctx.onLog);
        await this.prisma.systemUpdate.update({
          where: { id: updateId },
          data: {
            status: 'rolled_back',
            canaryMetricsJson: metrics as unknown as Prisma.InputJsonValue,
          },
        });
        this.updatesGateway.emitStatus(updateId, 'rolled_back');
        return;
      }

      await this.prisma.systemUpdate.update({
        where: { id: updateId },
        data: {
          status: 'applied',
          appliedAt: new Date(),
          canaryMetricsJson: metrics as unknown as Prisma.InputJsonValue,
        },
      });
      this.updatesGateway.emitStatus(updateId, 'applied');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.appendLog(updateId, {
        at: new Date().toISOString(),
        level: 'error',
        message,
      });
      await this.prisma.systemUpdate.update({
        where: { id: updateId },
        data: { status: 'test_failed' },
      });
      this.updatesGateway.emitStatus(updateId, 'test_failed');
      throw error;
    }
  }

  private async runRollback(updateId: string, rollbackVersion: string) {
    await this.runner.rollback(rollbackVersion, (entry) =>
      this.appendLog(updateId, entry),
    );
    await this.prisma.systemUpdate.update({
      where: { id: updateId },
      data: { status: 'rolled_back', rollbackVersion },
    });
    this.updatesGateway.emitStatus(updateId, 'rolled_back');
  }

  private async appendLog(updateId: string, entry: DeployLogEntry) {
    const update = await this.requireUpdate(updateId);
    const current = (update.deployLogJson as DeployLogEntry[] | null) ?? [];
    const next = [...current, entry].slice(-DEPLOY_LOG_MAX);
    await this.prisma.systemUpdate.update({
      where: { id: updateId },
      data: { deployLogJson: next as unknown as Prisma.InputJsonValue },
    });
    this.updatesGateway.emitLog(updateId, entry);
  }

  private async requireUpdate(id: string) {
    const row = await this.prisma.systemUpdate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Обновление не найдено');
    return row;
  }

  private toDto(row: {
    id: string;
    version: string;
    changelog: string | null;
    gitSha: string | null;
    imageTag: string | null;
    status: SystemUpdateStatus;
    testReportJson: unknown;
    deployLogJson: unknown;
    canaryMetricsJson: unknown;
    backupSnapshotId: string | null;
    appliedAt: Date | null;
    rollbackVersion: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SystemUpdateDto {
    return {
      id: row.id,
      version: row.version,
      changelog: row.changelog,
      gitSha: row.gitSha,
      imageTag: row.imageTag,
      status: row.status,
      testReport: (row.testReportJson as SystemUpdateDto['testReport']) ?? null,
      deployLog: (row.deployLogJson as DeployLogEntry[]) ?? [],
      canaryMetrics:
        (row.canaryMetricsJson as SystemUpdateDto['canaryMetrics']) ?? null,
      backupSnapshotId: row.backupSnapshotId,
      appliedAt: row.appliedAt?.toISOString() ?? null,
      rollbackVersion: row.rollbackVersion,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Public, RequirePermission } from '../../common/decorators/auth.decorators';
import { PERMISSIONS } from '../../common/constants/permissions';
import { ReleaseService } from '../release/release.service';
import { SystemUpdatesService } from './services/system-updates.service';
import { DeploymentRecordsService } from './services/deployment-records.service';
import { StabilityMonitorService } from './services/stability-monitor.service';
import { HostDeployQueueService } from './services/host-deploy-queue.service';
import {
  ReleaseCompleteDto,
  ReleaseReportDto,
  SyncReleaseManifestDto,
} from './dto/release.dto';

@Controller('admin/release')
export class ReleaseController {
  constructor(
    private readonly release: ReleaseService,
    private readonly updates: SystemUpdatesService,
    private readonly deployments: DeploymentRecordsService,
    private readonly stability: StabilityMonitorService,
    private readonly hostDeployQueue: HostDeployQueueService,
  ) {}

  @Get('current')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_VIEW)
  getCurrent() {
    return this.release.getCurrent();
  }

  @Get('sprints')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_VIEW)
  listSprints() {
    return this.release.listSprints();
  }

  @Get('deployments')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_VIEW)
  listDeployments() {
    return this.deployments.list();
  }

  @Get('sprint-matrix')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_VIEW)
  async sprintMatrix() {
    const sprints = this.release
      .listSprints()
      .filter((s) => s.status.toLowerCase() === 'done');
    const deployments = await this.deployments.list(200);
    const active = await this.deployments.getActive();
    const current = this.release.getCurrent();

    const latestBySprint = new Map<number, (typeof deployments)[0]>();
    for (const row of deployments) {
      const prev = latestBySprint.get(row.sprint);
      if (!prev || new Date(row.appliedAt) > new Date(prev.appliedAt)) {
        latestBySprint.set(row.sprint, row);
      }
    }

    const liveSprint = active?.sprint ?? current.sprint;

    const rows = sprints
      .map((s) => {
        const version = this.release.getSuggestedVersion(s.number);
        const record = latestBySprint.get(s.number);
        const isLive = liveSprint === s.number;
        return {
          sprint: s.number,
          version,
          description: s.description,
          planStatus: s.status,
          deployed: Boolean(record),
          deployStatus: record?.status ?? ('not_deployed' as const),
          appliedAt: record?.appliedAt ?? null,
          gitSha: record?.gitSha ?? null,
          isLive,
          canRollback: Boolean(
            record &&
              !isLive &&
              record.status !== 'rolled_back' &&
              s.number < liveSprint,
          ),
        };
      })
      .sort((a, b) => b.sprint - a.sprint);

    return {
      currentVersion: current.version,
      currentSprint: current.sprint,
      previousVersion: current.previousVersion ?? null,
      rows,
    };
  }

  @Get('updates/:id/instructions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_MANAGE)
  async deployInstructions(@Param('id') id: string) {
    const update = await this.updates.get(id);
    return this.updates.getDeployInstructions(update);
  }

  @Public()
  @Post('sync')
  async syncManifest(
    @Headers('x-release-token') token: string,
    @Body() dto: SyncReleaseManifestDto,
  ) {
    this.release.validateDeployToken(token);
    const manifest = await this.release.syncManifest(dto);
    await this.deployments.recordDeployment(manifest);
    return manifest;
  }

  @Public()
  @Post('report')
  async report(
    @Headers('x-release-token') token: string,
    @Body() dto: ReleaseReportDto,
  ) {
    this.release.validateDeployToken(token);
    return this.updates.reportDeployLog(dto.updateId, dto.level, dto.message);
  }

  @Public()
  @Post('complete')
  async complete(
    @Headers('x-release-token') token: string,
    @Body() dto: ReleaseCompleteDto,
  ) {
    this.release.validateDeployToken(token);
    return this.updates.completeHostDeploy(
      dto.updateId,
      dto.success,
      dto.version,
      dto.sprint,
    );
  }

  @Post('rollback/:version/execute')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_MANAGE)
  async executeRollback(@Param('version') version: string) {
    const record = await this.deployments.findByVersion(version);
    if (!record) {
      return {
        ok: false,
        message: `Деплой версии ${version} не найден в истории`,
      };
    }
    return this.updates.queueHostRollback(version);
  }

  @Post('rollback/:version')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_MANAGE)
  async rollbackToVersion(@Param('version') version: string) {
    const record = await this.deployments.findByVersion(version);
    if (!record) {
      return {
        ok: false,
        message: `Деплой версии ${version} не найден в истории`,
        command: `sudo bash ${process.env.HOST_INSTALL_DIR ?? '/opt/redflow'}/scripts/release-rollback.sh ${version}`,
      };
    }
    const installDir = process.env.HOST_INSTALL_DIR ?? '/opt/redflow';
    const result = await this.updates.queueHostRollback(version);
    return {
      ...result,
      sprint: record.sprint,
      command: `sudo bash ${installDir}/scripts/release-rollback.sh ${version}`,
    };
  }

  @Public()
  @Get('host-job/next')
  async claimHostJob(@Headers('x-release-token') token: string) {
    this.release.validateDeployToken(token);
    const job = await this.hostDeployQueue.claimJob();
    return { job };
  }

  @Public()
  @Get('host-job/pending')
  async peekHostJob(@Headers('x-release-token') token: string) {
    this.release.validateDeployToken(token);
    const job = await this.hostDeployQueue.peekJob();
    return { job };
  }

  @Public()
  @Post('host-job/finished')
  async finishHostJob(
    @Headers('x-release-token') token: string,
    @Body()
    body: {
      updateId?: string;
      success: boolean;
      version: string;
      sprint: number;
      type: 'deploy' | 'rollback';
      rollbackTarget?: string;
    },
  ) {
    this.release.validateDeployToken(token);

    if (body.type === 'deploy' && body.updateId) {
      return this.updates.completeHostDeploy(
        body.updateId,
        body.success,
        body.version,
        body.sprint,
      );
    }

    if (body.type === 'rollback' && body.success) {
      const active = await this.deployments.getActive();
      if (active) {
        await this.deployments.markRolledBack(active.version);
      }
      if (body.updateId) {
        await this.updates.completeHostDeploy(
          body.updateId,
          false,
          body.version,
          body.sprint,
        );
      }
    }

    return { ok: body.success };
  }

  @Post('sync-sprints')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_MANAGE)
  syncSprints() {
    return this.updates.syncSprintsFromDocs();
  }
}

@Controller('admin/stability')
export class StabilityController {
  constructor(private readonly stability: StabilityMonitorService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_VIEW)
  getStatus() {
    return this.stability.getStatus();
  }

  @Get('incidents')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_VIEW)
  listIncidents() {
    return this.stability.listIncidents();
  }

  @Post('check')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_MANAGE)
  runCheck() {
    return this.stability.runChecks();
  }
}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '../../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { MarginAnalyticsService } from './services/margin-analytics.service';
import { AdminTenantsService } from './services/admin-tenants.service';
import { AuditLogService } from './services/audit-log.service';
import { BackupSnapshotService } from './services/backup-snapshot.service';
import { DeploymentRunnerService } from './services/deployment-runner.service';
import { SystemUpdatesService } from './services/system-updates.service';
import { SystemUpdateProcessor } from './processors/system-update.processor';
import { UpdatesGateway } from './gateways/updates.gateway';
import { AdminSystemHealthService } from './services/admin-system-health.service';
import { SiteSettingsController } from './site-settings.controller';
import { SiteSettingsService } from './services/site-settings.service';
import { DiagnosticsTokenService } from './services/diagnostics-token.service';
import { PlatformWorkspaceService } from './services/platform-workspace.service';
import { DeploymentRecordsService } from './services/deployment-records.service';
import { StabilityMonitorService } from './services/stability-monitor.service';
import { ReleaseController, StabilityController } from './release.controller';
import { ReleaseModule } from '../release/release.module';
import { QUEUE_SYSTEM_UPDATES } from './constants';
import { QUEUE_CRM_EXPORT, QUEUE_CRM_STATUS_SYNC, QUEUE_LEAD_DELIVERY } from '../integrations/constants';
import { QUEUE_CRAWL_SITE, QUEUE_INGEST_DOCUMENT } from '../knowledge/constants';
import { AiModule } from '../ai/ai.module';
import { SourcesModule } from '../sources/sources.module';

@Module({
  imports: [
    AiModule,
    AuthModule,
    SourcesModule,
    RedisModule,
    ReleaseModule,
    BullModule.registerQueue(
      { name: QUEUE_SYSTEM_UPDATES },
      { name: QUEUE_CRM_EXPORT },
      { name: QUEUE_CRM_STATUS_SYNC },
      { name: QUEUE_LEAD_DELIVERY },
      { name: QUEUE_CRAWL_SITE },
      { name: QUEUE_INGEST_DOCUMENT },
    ),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminController, ReleaseController, StabilityController, SiteSettingsController],
  providers: [
    MarginAnalyticsService,
    AdminTenantsService,
    AuditLogService,
    BackupSnapshotService,
    DeploymentRunnerService,
    SystemUpdatesService,
    SystemUpdateProcessor,
    UpdatesGateway,
    AdminSystemHealthService,
    SiteSettingsService,
    DiagnosticsTokenService,
    PlatformWorkspaceService,
    DeploymentRecordsService,
    StabilityMonitorService,
  ],
  exports: [SiteSettingsService, DiagnosticsTokenService, StabilityMonitorService],
})
export class AdminModule {}

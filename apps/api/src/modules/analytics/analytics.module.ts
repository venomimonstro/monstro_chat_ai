import { Module } from '@nestjs/common';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { TenantAnalyticsController } from './controllers/tenant-analytics.controller';
import { AnalyticsCacheService } from './services/analytics-cache.service';
import { ReportBuilderService } from './services/report-builder.service';
import { AnalyticsExportService } from './services/analytics-export.service';
import { AnalyticsDashboardService } from './services/analytics-dashboard.service';
import { AnalyticsReportCronService } from './services/analytics-report-cron.service';

@Module({
  controllers: [AdminAnalyticsController, TenantAnalyticsController],
  providers: [
    AnalyticsCacheService,
    ReportBuilderService,
    AnalyticsExportService,
    AnalyticsDashboardService,
    AnalyticsReportCronService,
  ],
  exports: [ReportBuilderService, AnalyticsCacheService],
})
export class AnalyticsModule {}

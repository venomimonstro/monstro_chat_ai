import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  AnalyticsQueryRequest,
  CreateReportScheduleDto,
  SaveAnalyticsDashboardDto,
} from '@ai-consultant/shared-types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/auth.decorators';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { ReportBuilderService } from '../services/report-builder.service';
import { AnalyticsExportService } from '../services/analytics-export.service';
import { AnalyticsDashboardService } from '../services/analytics-dashboard.service';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminAnalyticsController {
  constructor(
    private readonly reportBuilder: ReportBuilderService,
    private readonly exportService: AnalyticsExportService,
    private readonly dashboards: AnalyticsDashboardService,
  ) {}

  @Get('query')
  @RequirePermission(PERMISSIONS.ADMIN_ANALYTICS_VIEW)
  query(
    @Query('metric') metric: AnalyticsQueryRequest['metric'],
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('dimension') dimension?: AnalyticsQueryRequest['dimension'],
    @Query('tenantId') tenantId?: string,
  ) {
    return this.reportBuilder.query({
      metric,
      dimension,
      from,
      to,
      tenantId,
    });
  }

  @Get('export')
  @RequirePermission(PERMISSIONS.ADMIN_ANALYTICS_VIEW)
  async export(
    @Res() res: Response,
    @Query('format') format: 'csv' | 'html' | 'pdf' = 'csv',
    @Query('metric') metric: AnalyticsQueryRequest['metric'],
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('dimension') dimension?: AnalyticsQueryRequest['dimension'],
    @Query('tenantId') tenantId?: string,
  ) {
    const data = await this.reportBuilder.query({
      metric,
      dimension,
      from,
      to,
      tenantId,
    });

    if (format === 'csv') {
      const csv = this.exportService.toCsv(data, 'query');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="analytics-${metric}.csv"`,
      );
      return res.send(csv);
    }

    const html = this.exportService.toHtmlReport(data, `Analytics: ${metric}`);
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="analytics-${metric}.html"`,
      );
      return res.send(html);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  @Get('dashboards')
  @RequirePermission(PERMISSIONS.ADMIN_ANALYTICS_VIEW)
  listDashboards() {
    return this.dashboards.listAdmin();
  }

  @Post('dashboards')
  @RequirePermission(PERMISSIONS.ADMIN_ANALYTICS_MANAGE)
  createDashboard(@Body() dto: SaveAnalyticsDashboardDto) {
    return this.dashboards.createAdmin(dto);
  }

  @Patch('dashboards/:id')
  @RequirePermission(PERMISSIONS.ADMIN_ANALYTICS_MANAGE)
  updateDashboard(
    @Param('id') id: string,
    @Body() dto: SaveAnalyticsDashboardDto,
  ) {
    return this.dashboards.updateAdmin(id, dto);
  }

  @Get('dashboards/:id/schedules')
  @RequirePermission(PERMISSIONS.ADMIN_ANALYTICS_VIEW)
  listSchedules(@Param('id') dashboardId: string) {
    return this.dashboards.listSchedules(dashboardId);
  }

  @Post('schedules')
  @RequirePermission(PERMISSIONS.ADMIN_ANALYTICS_MANAGE)
  createSchedule(@Body() dto: CreateReportScheduleDto) {
    return this.dashboards.createSchedule(dto);
  }
}

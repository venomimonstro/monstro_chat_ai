import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/auth.decorators';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { AuthenticatedUser } from '../../../common/interfaces/jwt-payload.interface';
import { ReportBuilderService } from '../services/report-builder.service';
import { AnalyticsExportService } from '../services/analytics-export.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenantAnalyticsController {
  constructor(
    private readonly reportBuilder: ReportBuilderService,
    private readonly exportService: AnalyticsExportService,
  ) {}

  @Get('statistics')
  @RequirePermission(PERMISSIONS.ANALYTICS_VIEW)
  getStatistics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportBuilder.getTenantStatistics(user.tenantId!, from, to);
  }

  @Get('export.csv')
  @RequirePermission(PERMISSIONS.ANALYTICS_VIEW)
  async exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const data = await this.reportBuilder.getTenantStatistics(
      user.tenantId!,
      from,
      to,
    );
    const csv = this.exportService.toCsv(data, 'tenant');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="statistics.csv"',
    );
    return res.send(csv);
  }
}

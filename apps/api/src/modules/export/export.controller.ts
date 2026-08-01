import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@Controller('export')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('leads.csv')
  @RequirePermission(PERMISSIONS.CRM_LEADS_VIEW)
  async exportLeads(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportLeadsCsv(user.tenantId!);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(csv);
  }

  @Get('tenant-data.json')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  async exportTenantData(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const data = await this.exportService.exportTenantJson(user.tenantId!);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="tenant-export.json"',
    );
    res.send(data);
  }
}

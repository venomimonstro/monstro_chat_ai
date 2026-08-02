import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission, Public } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { AuthService } from '../auth/auth.service';
import { ProviderRegistryService } from '../ai/providers/provider-registry.service';
import { AdminTenantsService } from './services/admin-tenants.service';
import { AuditLogService } from './services/audit-log.service';
import { BackupSnapshotService } from './services/backup-snapshot.service';
import { SystemUpdatesService } from './services/system-updates.service';
import {
  ImpersonateTenantDto,
  ImpersonationExchangeDto,
  TenantActionReasonDto,
  TenantBalanceAdjustmentDto,
  TenantTariffChangeDto,
} from './dto/admin-tenants.dto';
import { CreateBackupDto, CreateSystemUpdateDto } from './dto/system-updates.dto';
import { BulkBlockTenantsDto, SetProviderCredentialsDto, UpdateProvidersDto } from './dto/admin-providers.dto';
import { UpdateSiteSettingsDto } from './dto/site-settings.dto';
import { AdminSystemHealthService } from './services/admin-system-health.service';
import { SiteSettingsService } from './services/site-settings.service';
import { ReleaseService } from '../release/release.service';
import type { AuditLogListQuery, TenantListQuery } from '@ai-consultant/shared-types';

function requestMeta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(
    private readonly tenants: AdminTenantsService,
    private readonly auditLog: AuditLogService,
    private readonly backups: BackupSnapshotService,
    private readonly updates: SystemUpdatesService,
    private readonly authService: AuthService,
    private readonly providers: ProviderRegistryService,
    private readonly systemHealth: AdminSystemHealthService,
    private readonly siteSettings: SiteSettingsService,
    private readonly release: ReleaseService,
  ) {}

  @Get('status')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)
  getStatus() {
    const current = this.release.getCurrent();
    return {
      status: 'ok',
      sprint: current.sprint,
      version: current.version,
    };
  }

  @Get('system/health')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)
  getSystemHealth() {
    return this.systemHealth.getHealth();
  }

  @Get('providers')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)
  listProviders() {
    return this.providers.listForAdmin();
  }

  @Patch('providers')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  updateProviders(@Body() dto: UpdateProvidersDto) {
    return this.providers.updateAdminConfig(dto);
  }

  @Put('providers/:name/credentials')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  setProviderCredentials(
    @Param('name') name: string,
    @Body() dto: SetProviderCredentialsDto,
  ) {
    return this.providers.setProviderCredentials(name, dto.apiKey);
  }

  @Delete('providers/:name/credentials')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  clearProviderCredentials(@Param('name') name: string) {
    return this.providers.clearProviderCredentials(name);
  }

  @Get('site-settings')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)
  getSiteSettings() {
    return this.siteSettings.getPublicConfig();
  }

  @Patch('site-settings')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  updateSiteSettings(@Body() dto: UpdateSiteSettingsDto) {
    return this.siteSettings.update(dto);
  }

  @Get('tenants')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)
  listTenants(@Query() query: TenantListQuery) {
    return this.tenants.listTenants(query);
  }

  @Get('tenants/export.csv')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)
  async exportTenants(
    @Query() query: TenantListQuery,
    @Res() res: Response,
  ) {
    const csv = await this.tenants.exportTenantsCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="tenants.csv"',
    );
    res.send(csv);
  }

  @Post('tenants/bulk-block')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  bulkBlockTenants(
    @Body() dto: BulkBlockTenantsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.tenants.blockTenantsBulk(
      dto.tenantIds,
      dto.reason,
      user,
      requestMeta(req),
    );
  }

  @Get('tenants/:id')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)
  getTenant(@Param('id') id: string) {
    return this.tenants.getTenantDetail(id);
  }

  @Get('tenants/:id/margin')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)
  getTenantMargin(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tenants.getTenantMargin(
      id,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Patch('tenants/:id/block')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  blockTenant(
    @Param('id') id: string,
    @Body() dto: TenantActionReasonDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.tenants.blockTenant(id, dto.reason, user, requestMeta(req));
  }

  @Patch('tenants/:id/unblock')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  unblockTenant(
    @Param('id') id: string,
    @Body() dto: TenantActionReasonDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.tenants.unblockTenant(id, dto.reason, user, requestMeta(req));
  }

  @Patch('tenants/:id/tariff')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  changeTariff(
    @Param('id') id: string,
    @Body() dto: TenantTariffChangeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.tenants.changeTariff(
      id,
      dto.tariffId,
      dto.reason,
      user,
      requestMeta(req),
    );
  }

  @Post('tenants/:id/balance-adjustment')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  adjustBalance(
    @Param('id') id: string,
    @Body() dto: TenantBalanceAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.tenants.adjustBalance(
      id,
      dto.amount,
      dto.reason,
      user,
      requestMeta(req),
    );
  }

  @Post('tenants/:id/reset-password')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  resetPassword(
    @Param('id') id: string,
    @Body() dto: TenantActionReasonDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.tenants.resetOwnerPassword(id, dto.reason, user, requestMeta(req));
  }

  @Post('tenants/:id/impersonate')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  impersonate(
    @Param('id') id: string,
    @Body() dto: ImpersonateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.tenants.impersonate(id, dto.reason, user, requestMeta(req));
  }

  @Public()
  @Post('impersonation/exchange')
  async exchangeImpersonationCode(
    @Body() dto: ImpersonationExchangeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken } = await this.tenants.exchangeImpersonationCode(
      dto.exchangeCode,
    );
    this.authService.applyAccessSession(res, req, accessToken, 'client');
    return { success: true };
  }

  @Get('audit-logs')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)
  listAuditLogs(@Query() query: AuditLogListQuery) {
    return this.auditLog.list(query);
  }

  @Get('updates')
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_VIEW)
  listUpdates() {
    return this.updates.list();
  }

  @Post('updates')
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_MANAGE)
  createUpdate(@Body() dto: CreateSystemUpdateDto) {
    return this.updates.create(dto);
  }

  @Get('updates/:id')
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_VIEW)
  getUpdate(@Param('id') id: string) {
    return this.updates.get(id);
  }

  @Post('updates/:id/test')
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_MANAGE)
  testUpdate(@Param('id') id: string) {
    return this.updates.enqueueStagingTest(id);
  }

  @Post('updates/:id/approve')
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_MANAGE)
  approveUpdate(@Param('id') id: string) {
    return this.updates.enqueueProductionDeploy(id);
  }

  @Post('updates/:id/rollback')
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_MANAGE)
  rollbackUpdate(
    @Param('id') id: string,
    @Body('rollbackVersion') rollbackVersion: string,
  ) {
    return this.updates.enqueueRollback(id, rollbackVersion ?? 'previous');
  }

  @Get('backups')
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_VIEW)
  listBackups() {
    return this.backups.list();
  }

  @Post('backups')
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_MANAGE)
  createBackup(@Body() dto: CreateBackupDto) {
    return this.backups.create(dto.label);
  }

  @Post('backups/:id/restore')
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_MANAGE)
  restoreBackup(@Param('id') id: string) {
    return this.backups.restore(id);
  }
}

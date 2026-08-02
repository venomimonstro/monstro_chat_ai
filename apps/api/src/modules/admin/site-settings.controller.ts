import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { PERMISSIONS } from '../../common/constants/permissions';
import { SiteSettingsService } from './services/site-settings.service';
import { DiagnosticsTokenService } from './services/diagnostics-token.service';
import { PlatformWorkspaceService } from './services/platform-workspace.service';
import { UpdateSiteSettingsDto } from './dto/site-settings.dto';

@Controller('admin/site-settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SiteSettingsController {
  constructor(
    private readonly siteSettings: SiteSettingsService,
    private readonly diagnostics: DiagnosticsTokenService,
    private readonly platformWorkspace: PlatformWorkspaceService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)
  getSiteSettings() {
    return this.siteSettings.getPublicConfig();
  }

  @Patch()
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  updateSiteSettings(@Body() dto: UpdateSiteSettingsDto) {
    return this.siteSettings.update(dto);
  }

  @Get('diagnostics-link')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_VIEW)
  async getDiagnosticsLink() {
    const token = await this.diagnostics.getToken();
    return { token, ...this.diagnostics.buildPublicUrls(token) };
  }

  @Post('diagnostics-link/regenerate')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  async regenerateDiagnosticsLink() {
    const token = await this.diagnostics.regenerate();
    return { token, ...this.diagnostics.buildPublicUrls(token) };
  }

  @Post('sync-platform-widget')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  async syncPlatformWidget() {
    const workspace = await this.platformWorkspace.getWorkspace();
    return this.siteSettings.update({
      demoWidgetKey: workspace.widgetKey,
      chatEnabled: true,
    });
  }
}

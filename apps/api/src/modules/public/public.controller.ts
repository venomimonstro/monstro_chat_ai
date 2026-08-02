import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/auth.decorators';
import { TariffsService } from '../billing/services/tariffs.service';
import { SiteSettingsService } from '../admin/services/site-settings.service';
import { ReleaseService } from '../release/release.service';
import { StabilityMonitorService } from '../admin/services/stability-monitor.service';
import { DiagnosticsTokenService } from '../admin/services/diagnostics-token.service';

@Controller('public')
export class PublicController {
  constructor(
    private readonly tariffs: TariffsService,
    private readonly siteSettings: SiteSettingsService,
    private readonly release: ReleaseService,
    private readonly stability: StabilityMonitorService,
    private readonly diagnostics: DiagnosticsTokenService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('tariffs')
  listTariffs() {
    return this.tariffs.listActive();
  }

  @Public()
  @Get('demo-widget')
  getDemoWidget() {
    return this.siteSettings.getPublicConfig();
  }

  @Public()
  @Get('site-scripts')
  getSiteScripts() {
    return this.siteSettings.getPublicScripts();
  }

  @Public()
  @Get('release')
  getRelease() {
    return this.release.getCurrent();
  }

  @Public()
  @Get('diagnostics/:token')
  async getDiagnostics(@Param('token') token: string) {
    if (!(await this.diagnostics.validate(token))) {
      throw new NotFoundException('Диагностическая ссылка недействительна');
    }

    const status = await this.stability.runChecks();
    const release = this.release.getCurrent();

    return {
      ...status,
      version: release.version,
      sprint: release.sprint,
      checkedAt: new Date().toISOString(),
      services: {
        api: this.config.get('API_PUBLIC_URL', 'http://localhost:3000/api'),
        webClient: this.config.get('WEB_CLIENT_URL', 'http://localhost:5173'),
        webAdmin: this.config.get('WEB_ADMIN_URL', 'http://localhost:5174'),
        publicSite: this.config.get('PUBLIC_SITE_URL', 'http://localhost:4321'),
        widget: this.config.get('WIDGET_URL', 'http://localhost:5175'),
      },
    };
  }
}

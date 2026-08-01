import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/auth.decorators';
import { TariffsService } from '../billing/services/tariffs.service';
import { SiteSettingsService } from '../admin/services/site-settings.service';

@Controller('public')
export class PublicController {
  constructor(
    private readonly tariffs: TariffsService,
    private readonly siteSettings: SiteSettingsService,
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
}

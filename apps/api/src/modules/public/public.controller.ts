import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/auth.decorators';
import { TariffsService } from '../billing/services/tariffs.service';

@Controller('public')
export class PublicController {
  constructor(
    private readonly tariffs: TariffsService,
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
    const widgetKey = this.config.get<string>('DEMO_WIDGET_KEY', '');
    const apiUrl = this.config.get<string>(
      'API_PUBLIC_URL',
      'http://localhost:3000/api',
    );
    const widgetUrl = this.config.get<string>(
      'WIDGET_URL',
      'http://localhost:5175',
    );
    return { widgetKey, apiUrl, widgetUrl, enabled: Boolean(widgetKey) };
  }
}

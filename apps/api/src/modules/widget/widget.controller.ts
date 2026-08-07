import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Header,
  Query,
  NotFoundException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { SourcesService } from '../sources/sources.service';
import { DialogService } from '../ai/services/dialog.service';
import { Public } from '../../common/decorators/auth.decorators';
import { WidgetPingDto } from '../sources/dto/source.dto';
import { mergeSourceConfig } from '@ai-consultant/shared-types';
import { assertWidgetOrigin } from './utils/widget-origin.guard';
import { WidgetSessionService } from './services/widget-session.service';

@Controller('widget')
@Public()
export class WidgetController {
  constructor(
    private readonly sourcesService: SourcesService,
    private readonly dialogService: DialogService,
    private readonly widgetSession: WidgetSessionService,
  ) {}

  @Get('health')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Cache-Control', 'no-cache')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      latencyHintMs: 50,
    };
  }

  @Get('config/:widgetKey')
  @Header('Cache-Control', 'no-cache')
  @Header('Access-Control-Allow-Origin', '*')
  async getConfig(
    @Param('widgetKey') widgetKey: string,
    @Req() req: Request,
  ) {
    const source = await this.sourcesService.findByWidgetKey(widgetKey);
    if (!source || source.status !== 'active') {
      return { error: 'not_found' };
    }

    assertWidgetOrigin(
      this.sourcesService,
      source,
      req.headers.origin,
      req.headers.referer,
    );

    const config = mergeSourceConfig(
      source.configJson as Parameters<typeof mergeSourceConfig>[0],
    );

    return {
      widgetKey: source.widgetKey,
      status: source.status,
      config,
      configVersion: source.configVersion,
    };
  }

  @Get('config/version/:widgetKey')
  @Header('Cache-Control', 'no-cache')
  @Header('Access-Control-Allow-Origin', '*')
  async getConfigVersion(
    @Param('widgetKey') widgetKey: string,
    @Req() req: Request,
  ) {
    const source = await this.sourcesService.findByWidgetKey(widgetKey);
    if (!source || source.status !== 'active') {
      return { widgetKey, status: 'inactive', configVersion: 0 };
    }

    assertWidgetOrigin(
      this.sourcesService,
      source,
      req.headers.origin,
      req.headers.referer,
    );

    return {
      widgetKey: source.widgetKey,
      status: source.status,
      configVersion: source.configVersion,
    };
  }

  @Post('ping')
  @Header('Access-Control-Allow-Origin', '*')
  async ping(@Body() dto: WidgetPingDto, @Req() req: Request) {
    const source = await this.sourcesService.findByWidgetKey(dto.widgetKey);
    if (source) {
      assertWidgetOrigin(
        this.sourcesService,
        source,
        req.headers.origin,
        req.headers.referer,
      );
    }
    return this.sourcesService.recordPing(dto.widgetKey);
  }

  @Get('dialog/:dialogId/messages')
  @Header('Access-Control-Allow-Origin', '*')
  async getDialogMessages(
    @Param('dialogId') dialogId: string,
    @Query('widgetKey') widgetKey: string,
    @Query('visitorId') visitorId: string,
    @Query('sessionToken') sessionToken: string,
    @Req() req: Request,
  ) {
    if (!widgetKey || !visitorId) {
      throw new NotFoundException();
    }
    const source = await this.sourcesService.findByWidgetKey(widgetKey);
    if (!source) throw new NotFoundException();
    assertWidgetOrigin(
      this.sourcesService,
      source,
      req.headers.origin,
      req.headers.referer,
    );
    this.widgetSession.assertToken(sessionToken, {
      widgetKey,
      visitorId,
      dialogId,
    });
    return this.dialogService.getPublicHistory(dialogId, widgetKey, visitorId);
  }
}

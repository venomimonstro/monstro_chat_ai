import { Controller, Get, Post, Body, Param, Header, Query, NotFoundException } from '@nestjs/common';
import { SourcesService } from '../sources/sources.service';
import { DialogService } from '../ai/services/dialog.service';
import { MessageFeedbackService } from '../quality/services/message-feedback.service';
import { Public } from '../../common/decorators/auth.decorators';
import { WidgetPingDto } from '../sources/dto/source.dto';
import { WidgetFeedbackDto } from '../quality/dto/quality.dto';
import { mergeSourceConfig } from '@ai-consultant/shared-types';

@Controller('widget')
@Public()
export class WidgetController {
  constructor(
    private readonly sourcesService: SourcesService,
    private readonly dialogService: DialogService,
    private readonly feedbackService: MessageFeedbackService,
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
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Cache-Control', 'no-cache')
  async getConfig(@Param('widgetKey') widgetKey: string) {
    const source = await this.sourcesService.findByWidgetKey(widgetKey);
    if (!source || source.status !== 'active') {
      return { error: 'not_found' };
    }

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
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Cache-Control', 'no-cache')
  async getConfigVersion(@Param('widgetKey') widgetKey: string) {
    const source = await this.sourcesService.findByWidgetKey(widgetKey);
    if (!source || source.status !== 'active') {
      return { widgetKey, status: 'inactive', configVersion: 0 };
    }
    return {
      widgetKey: source.widgetKey,
      status: source.status,
      configVersion: source.configVersion,
    };
  }

  @Post('ping')
  @Header('Access-Control-Allow-Origin', '*')
  async ping(@Body() dto: WidgetPingDto) {
    return this.sourcesService.recordPing(dto.widgetKey);
  }

  @Get('dialog/:dialogId/messages')
  @Header('Access-Control-Allow-Origin', '*')
  async getDialogMessages(
    @Param('dialogId') dialogId: string,
    @Query('widgetKey') widgetKey: string,
    @Query('visitorId') visitorId: string,
  ) {
    if (!widgetKey || !visitorId) {
      throw new NotFoundException();
    }
    return this.dialogService.getPublicHistory(dialogId, widgetKey, visitorId);
  }

  @Post('feedback')
  @Header('Access-Control-Allow-Origin', '*')
  submitFeedback(@Body() dto: WidgetFeedbackDto) {
    return this.feedbackService.submitFromWidget(dto);
  }
}

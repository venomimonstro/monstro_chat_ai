import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { ChannelMessageService } from './channel-message.service';
import { ChannelsSetupService } from './channels-setup.service';
import { VkChannelAdapter } from './channel-adapters';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import type {
  ConnectTelegramChannelDto,
  ConnectVkChannelDto,
} from '@ai-consultant/shared-types';

@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: ChannelMessageService,
    private readonly setup: ChannelsSetupService,
    private readonly vkAdapter: VkChannelAdapter,
  ) {}

  @Public()
  @Post('telegram/:widgetKey/webhook')
  async telegramWebhook(
    @Param('widgetKey') widgetKey: string,
    @Body() body: unknown,
  ) {
    const source = await this.prisma.source.findUnique({
      where: { widgetKey },
    });
    if (!source || source.type !== 'telegram' || source.status !== 'active') {
      return { ok: true };
    }
    void this.messages.handleInbound(source, body);
    return { ok: true };
  }

  @Public()
  @Post('vk/:widgetKey/webhook')
  async vkWebhook(
    @Param('widgetKey') widgetKey: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const source = await this.prisma.source.findUnique({
      where: { widgetKey },
    });
    if (!source || source.type !== 'vk') {
      return 'ok';
    }

    const payload = body as { type?: string };
    if (payload.type === 'confirmation') {
      return this.vkAdapter.getConfirmationResponse(source.configJson) ?? 'ok';
    }

    if (source.status === 'active') {
      void this.messages.handleInbound(source, body);
    }
    return 'ok';
  }

  @Post('telegram/:sourceId/connect')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  connectTelegram(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sourceId') sourceId: string,
    @Body() dto: ConnectTelegramChannelDto,
  ) {
    return this.setup.connectTelegram(user.tenantId!, sourceId, dto);
  }

  @Post('vk/:sourceId/connect')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  connectVk(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sourceId') sourceId: string,
    @Body() dto: ConnectVkChannelDto,
  ) {
    return this.setup.connectVk(user.tenantId!, sourceId, dto);
  }
}

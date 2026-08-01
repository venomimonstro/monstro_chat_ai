import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/auth.decorators';
import { RequirePermission } from '../../../common/decorators/auth.decorators';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { AuthenticatedUser } from '../../../common/interfaces/jwt-payload.interface';
import { LeadDeliveryService } from './lead-delivery.service';
import { GoogleSheetsOAuthService } from './google-sheets-oauth.service';
import {
  CreateLeadDeliveryChannelDto,
  UpdateLeadDeliveryChannelDto,
  ValidateTelegramDto,
} from './dto/lead-delivery.dto';

@Controller('integrations/lead-delivery')
export class LeadDeliveryController {
  constructor(
    private readonly delivery: LeadDeliveryService,
    private readonly googleOAuth: GoogleSheetsOAuthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  listChannels(@CurrentUser() user: AuthenticatedUser) {
    return this.delivery.listChannels(user.tenantId!);
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  listLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.delivery.listLogs(
      user.tenantId!,
      limit ? Number(limit) : 30,
    );
  }

  @Post('validate/telegram')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  validateTelegram(@Body() dto: ValidateTelegramDto) {
    return this.delivery.validateTelegram(dto);
  }

  @Public()
  @Get('google-sheets/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const payload = this.googleOAuth.verifyState(state);
    const tokens = await this.googleOAuth.exchangeCode(code);
    await this.delivery.saveGoogleCredentials(
      payload.tenantId,
      payload.channelId,
      tokens,
    );

    const clientUrl = this.config.get<string>(
      'WEB_CLIENT_URL',
      'http://localhost:5173',
    );
    return res.redirect(`${clientUrl}/integrations?connected=google_sheets`);
  }

  @Get('google-sheets/:channelId/connect-url')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  getGoogleConnectUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('channelId') channelId: string,
  ) {
    return {
      url: this.googleOAuth.buildConnectUrl(user.tenantId!, channelId),
    };
  }

  @Post('google-sheets/:channelId/mock-connect')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  mockConnectGoogle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('channelId') channelId: string,
  ) {
    const tokens = this.googleOAuth.createMockTokens();
    return this.delivery.saveGoogleCredentials(
      user.tenantId!,
      channelId,
      tokens,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  getChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.delivery.getChannel(user.tenantId!, id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  createChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeadDeliveryChannelDto,
  ) {
    return this.delivery.createChannel(user.tenantId!, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  updateChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDeliveryChannelDto,
  ) {
    return this.delivery.updateChannel(user.tenantId!, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  deleteChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.delivery.deleteChannel(user.tenantId!, id);
  }

  @Post(':id/test')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  sendTest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.delivery.sendTest(user.tenantId!, id);
  }
}

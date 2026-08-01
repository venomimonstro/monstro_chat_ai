import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationType } from '@prisma/client';
import type { Response } from 'express';
import { Public } from '../../common/decorators/auth.decorators';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/constants/permissions';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { IntegrationsService } from './integrations.service';
import { CrmOAuthService } from './services/crm-oauth.service';
import { CrmFieldMappingService } from './services/crm-field-mapping.service';
import { CrmSyncService } from './services/crm-sync.service';
import { CrmStatusMappingService } from './services/crm-status-mapping.service';
import { CrmStatusSyncService } from './services/crm-status-sync.service';
import {
  CrmInboundWebhookDto,
  SaveFieldMappingDto,
  SaveStatusMappingDto,
  UpsertGa4IntegrationDto,
  UpsertGtmIntegrationDto,
  UpsertMetrikaIntegrationDto,
} from './dto/integrations.dto';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly crmOAuth: CrmOAuthService,
    private readonly fieldMapping: CrmFieldMappingService,
    private readonly crmSync: CrmSyncService,
    private readonly statusMapping: CrmStatusMappingService,
    private readonly statusSync: CrmStatusSyncService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('status')
  getStatus() {
    return this.integrationsService.getStatus();
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.getOverview(user.tenantId!);
  }

  @Get('crm/sync-errors')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  listSyncErrors(@CurrentUser() user: AuthenticatedUser) {
    return this.crmSync.listSyncErrors(user.tenantId!);
  }

  @Post('crm/retry/:leadId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  retrySync(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leadId') leadId: string,
  ) {
    return this.crmSync.retryLeadExport(user.tenantId!, leadId);
  }

  @Get('amocrm/connect-url')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  getAmocrmConnectUrl(@CurrentUser() user: AuthenticatedUser) {
    return {
      url: this.crmOAuth.buildConnectUrl(
        user.tenantId!,
        IntegrationType.amocrm,
      ),
    };
  }

  @Public()
  @Get('amocrm/callback')
  async amocrmCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('referer') referer: string,
    @Res() res: Response,
  ) {
    await this.crmOAuth.handleCallback(
      IntegrationType.amocrm,
      code,
      state,
      referer,
    );
    return res.redirect(this.integrationsRedirect('amocrm'));
  }

  @Post('amocrm/mock-connect')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  mockConnectAmocrm(@CurrentUser() user: AuthenticatedUser) {
    return this.crmOAuth.connectMock(user.tenantId!, IntegrationType.amocrm);
  }

  @Delete('amocrm')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  disconnectAmocrm(@CurrentUser() user: AuthenticatedUser) {
    return this.crmOAuth.disconnect(user.tenantId!, IntegrationType.amocrm);
  }

  @Get('amocrm/field-mapping')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  getAmocrmFieldMapping(@CurrentUser() user: AuthenticatedUser) {
    return this.fieldMapping.list(user.tenantId!, IntegrationType.amocrm);
  }

  @Put('amocrm/field-mapping')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  saveAmocrmFieldMapping(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveFieldMappingDto,
  ) {
    return this.fieldMapping.save(
      user.tenantId!,
      IntegrationType.amocrm,
      dto.mappings,
    );
  }

  @Get('amocrm/status-mapping')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  getAmocrmStatusMapping(@CurrentUser() user: AuthenticatedUser) {
    return this.statusMapping.getMapping(user.tenantId!, 'amocrm');
  }

  @Put('amocrm/status-mapping')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  saveAmocrmStatusMapping(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveStatusMappingDto,
  ) {
    return this.statusMapping.saveMapping(user.tenantId!, 'amocrm', dto);
  }

  @Public()
  @Post('webhooks/amocrm/:tenantId')
  amocrmStatusWebhook(
    @Param('tenantId') tenantId: string,
    @Headers('x-webhook-secret') secret: string,
    @Body() dto: CrmInboundWebhookDto,
  ) {
    return this.statusSync.handleInboundWebhook(
      tenantId,
      IntegrationType.amocrm,
      secret,
      dto,
    );
  }

  @Get('bitrix24/connect-url')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  getBitrixConnectUrl(@CurrentUser() user: AuthenticatedUser) {
    return {
      url: this.crmOAuth.buildConnectUrl(
        user.tenantId!,
        IntegrationType.bitrix24,
      ),
    };
  }

  @Public()
  @Get('bitrix24/callback')
  async bitrix24Callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('domain') domain: string,
    @Res() res: Response,
  ) {
    await this.crmOAuth.handleCallback(
      IntegrationType.bitrix24,
      code,
      state,
      domain ? `https://${domain}` : undefined,
    );
    return res.redirect(this.integrationsRedirect('bitrix24'));
  }

  @Post('bitrix24/mock-connect')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  mockConnectBitrix24(@CurrentUser() user: AuthenticatedUser) {
    return this.crmOAuth.connectMock(user.tenantId!, IntegrationType.bitrix24);
  }

  @Delete('bitrix24')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  disconnectBitrix24(@CurrentUser() user: AuthenticatedUser) {
    return this.crmOAuth.disconnect(user.tenantId!, IntegrationType.bitrix24);
  }

  @Get('bitrix24/field-mapping')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  getBitrixFieldMapping(@CurrentUser() user: AuthenticatedUser) {
    return this.fieldMapping.list(user.tenantId!, IntegrationType.bitrix24);
  }

  @Put('bitrix24/field-mapping')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  saveBitrixFieldMapping(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveFieldMappingDto,
  ) {
    return this.fieldMapping.save(
      user.tenantId!,
      IntegrationType.bitrix24,
      dto.mappings,
    );
  }

  @Get('bitrix24/status-mapping')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  getBitrixStatusMapping(@CurrentUser() user: AuthenticatedUser) {
    return this.statusMapping.getMapping(user.tenantId!, 'bitrix24');
  }

  @Put('bitrix24/status-mapping')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  saveBitrixStatusMapping(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveStatusMappingDto,
  ) {
    return this.statusMapping.saveMapping(user.tenantId!, 'bitrix24', dto);
  }

  @Public()
  @Post('webhooks/bitrix24/:tenantId')
  bitrix24StatusWebhook(
    @Param('tenantId') tenantId: string,
    @Headers('x-webhook-secret') secret: string,
    @Body() dto: CrmInboundWebhookDto,
  ) {
    return this.statusSync.handleInboundWebhook(
      tenantId,
      IntegrationType.bitrix24,
      secret,
      dto,
    );
  }

  @Put('metrika')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  upsertMetrika(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertMetrikaIntegrationDto,
  ) {
    return this.integrationsService.upsertMetrika(user.tenantId!, dto);
  }

  @Put('gtm')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  upsertGtm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertGtmIntegrationDto,
  ) {
    return this.integrationsService.upsertGtm(user.tenantId!, dto);
  }

  @Put('ga4')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  upsertGa4(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertGa4IntegrationDto,
  ) {
    return this.integrationsService.upsertGa4(user.tenantId!, dto);
  }

  private integrationsRedirect(provider: string) {
    const clientUrl = this.config.get<string>(
      'WEB_CLIENT_URL',
      'http://localhost:5173',
    );
    return `${clientUrl}/integrations?connected=${provider}`;
  }
}

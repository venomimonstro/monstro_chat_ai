import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { OutgoingWebhookService } from './outgoing-webhook.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/auth.decorators';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/interfaces/jwt-payload.interface';
import type { SaveOutgoingWebhookDto } from '@ai-consultant/shared-types';

@Controller('integrations/outgoing-webhook')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
export class OutgoingWebhookController {
  constructor(private readonly webhooks: OutgoingWebhookService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.webhooks.getConfig(user.tenantId!);
  }

  @Post()
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveOutgoingWebhookDto,
  ) {
    return this.webhooks.saveConfig(user.tenantId!, dto);
  }

  @Post('generate-secret')
  generateSecret(@CurrentUser() user: AuthenticatedUser) {
    return this.webhooks.generateSecret(user.tenantId!);
  }
}

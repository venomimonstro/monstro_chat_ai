import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import type { PushSubscriptionDto } from '@ai-consultant/shared-types';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('vapid-public-key')
  getPublicKey() {
    return this.push.getPublicKey();
  }

  @Post('subscribe')
  subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PushSubscriptionDto,
  ) {
    return this.push.subscribe(user.id, user.tenantId!, dto);
  }

  @Delete('subscribe')
  unsubscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { endpoint: string },
  ) {
    return this.push.unsubscribe(user.id, body.endpoint);
  }
}

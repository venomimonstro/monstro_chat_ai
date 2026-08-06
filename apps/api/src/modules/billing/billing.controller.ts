import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { TariffsService } from './services/tariffs.service';
import { CheckoutService } from './services/checkout.service';
import { WebhookService } from './services/webhook.service';
import { WebhookVerificationService } from './services/webhook-verification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CreateTariffDto, UpdateTariffDto } from './dto/billing.dto';
import { CheckoutDto } from './dto/yookassa.dto';

@Controller('billing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly tariffsService: TariffsService,
    private readonly checkoutService: CheckoutService,
    private readonly webhookService: WebhookService,
    private readonly webhookVerification: WebhookVerificationService,
  ) {}

  @Get('tariffs')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  listTariffs() {
    return this.billingService.listTariffs();
  }

  @Get('overview')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getOverview(user.tenantId!);
  }

  @Post('checkout')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  checkout(
    @Body() dto: CheckoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkoutService.checkout(user.tenantId!, dto.tariffId);
  }

  @Get('payments')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  listPayments(@CurrentUser() user: AuthenticatedUser) {
    return this.checkoutService.listPayments(user.tenantId!);
  }

  @Get('transactions')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  listTransactions(@CurrentUser() user: AuthenticatedUser) {
    return this.checkoutService.listTransactions(user.tenantId!);
  }

  @Get('admin/tariffs')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  listAllTariffs() {
    return this.tariffsService.listAll();
  }

  @Post('admin/tariffs')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  createTariff(@Body() dto: CreateTariffDto) {
    return this.tariffsService.create(dto);
  }

  @Patch('admin/tariffs/:id')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  updateTariff(@Param('id') id: string, @Body() dto: UpdateTariffDto) {
    return this.tariffsService.update(id, dto);
  }

  @Delete('admin/tariffs/:id')
  @RequirePermission(PERMISSIONS.ADMIN_TENANTS_MANAGE)
  deactivateTariff(@Param('id') id: string) {
    return this.tariffsService.deactivate(id);
  }

  @Public()
  @Post('webhook/yookassa')
  async yookassaWebhook(
    @Body() body: unknown,
    @Headers('x-signature') signature?: string,
  ) {
    if (!this.webhookVerification.isConfigured()) {
      throw new UnauthorizedException('Webhook verification is not configured');
    }
    const raw = JSON.stringify(body);
    if (!this.webhookVerification.verify(raw, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    return this.webhookService.handle(body as never);
  }
}

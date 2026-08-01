import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { BillingModule } from '../billing/billing.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [BillingModule, AdminModule],
  controllers: [PublicController],
})
export class PublicModule {}

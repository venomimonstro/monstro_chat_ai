import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { BillingModule } from '../billing/billing.module';
import { AdminModule } from '../admin/admin.module';
import { ReleaseModule } from '../release/release.module';

@Module({
  imports: [BillingModule, AdminModule, ReleaseModule],
  controllers: [PublicController],
})
export class PublicModule {}

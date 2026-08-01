import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [PublicController],
})
export class PublicModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../redis/redis.module';
import { ReleaseModule } from '../modules/release/release.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [ConfigModule, RedisModule, ReleaseModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}

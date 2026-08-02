import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { ReleaseService } from './release.service';

@Module({
  imports: [RedisModule],
  providers: [ReleaseService],
  exports: [ReleaseService],
})
export class ReleaseModule {}

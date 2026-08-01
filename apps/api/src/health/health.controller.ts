import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/auth.decorators';
import { HealthService } from './health.service';

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get('db')
  async getDbHealth() {
    return this.healthService.getDbHealth();
  }

  @Get('redis')
  async getRedisHealth() {
    return this.healthService.getRedisHealth();
  }
}

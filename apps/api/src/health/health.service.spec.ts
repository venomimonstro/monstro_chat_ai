import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('HealthService', () => {
  let service: HealthService;

  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const mockRedis = {
    ping: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should return ok health status', () => {
    const result = service.getHealth();
    expect(result.status).toBe('ok');
    expect(result.version).toBe('0.1.0');
  });

  it('should return connected database status', async () => {
    const result = await service.getDbHealth();
    expect(result.database).toBe('connected');
  });

  it('should return connected redis status', async () => {
    const result = await service.getRedisHealth();
    expect(result.redis).toBe('connected');
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ReleaseService } from '../modules/release/release.service';

describe('HealthService', () => {
  let service: HealthService;

  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const mockRedis = {
    ping: jest.fn().mockResolvedValue(true),
  };

  const mockRelease = {
    getCurrent: jest.fn().mockReturnValue({ version: '0.33.0', sprint: 33 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: ReleaseService, useValue: mockRelease },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('0.1.0') },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should return ok health status', () => {
    const result = service.getHealth();
    expect(result.status).toBe('ok');
    expect(result.version).toBe('0.33.0');
    expect(result.sprint).toBe(33);
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

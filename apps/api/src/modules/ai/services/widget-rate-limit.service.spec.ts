import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WidgetRateLimitService } from './widget-rate-limit.service';
import { RedisService } from '../../../redis/redis.service';

describe('WidgetRateLimitService', () => {
  let service: WidgetRateLimitService;

  const mockRedis = {
    zremrangebyscore: jest.fn().mockResolvedValue(0),
    zcard: jest.fn(),
    zadd: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WidgetRateLimitService,
        {
          provide: RedisService,
          useValue: { getClient: () => mockRedis },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (_key: string, defaultVal: number) => defaultVal,
          },
        },
      ],
    }).compile();
    service = module.get(WidgetRateLimitService);
  });

  it('allows request when under limit', async () => {
    mockRedis.zcard.mockResolvedValue(0);
    const result = await service.checkLimit('visitor-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('blocks request when limit exceeded', async () => {
    mockRedis.zcard.mockResolvedValue(10);
    const result = await service.checkLimit('visitor-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

import { RedisService } from '../../../redis/redis.service';
import { CrmSyncLockService } from './crm-sync-lock.service';

describe('CrmSyncLockService', () => {
  const mockClient = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  const mockRedis = {
    getClient: jest.fn(() => mockClient),
  } as unknown as RedisService;

  let service: CrmSyncLockService;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockRedis.getClient as jest.Mock).mockReturnValue(mockClient);
    service = new CrmSyncLockService(mockRedis);
  });

  it('acquires lock when redis is available', async () => {
    mockClient.set.mockResolvedValue('OK');
    await expect(service.acquire('lead-1', 'internal')).resolves.toBe(true);
    expect(mockClient.set).toHaveBeenCalledWith(
      'crm:sync:lock:lead-1',
      'internal',
      'EX',
      5,
      'NX',
    );
  });

  it('returns true when redis is unavailable', async () => {
    (mockRedis.getClient as jest.Mock).mockReturnValue(null);
    await expect(service.acquire('lead-1', 'external')).resolves.toBe(true);
  });

  it('reads lock origin', async () => {
    mockClient.get.mockResolvedValue('external');
    await expect(service.getOrigin('lead-1')).resolves.toBe('external');
  });
});

import { DeploymentRunnerService } from './deployment-runner.service';

describe('DeploymentRunnerService', () => {
  const mockConfig = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'DEPLOY_HEALTH_URL') return 'http://localhost:3000/api/health';
      if (key === 'DEPLOY_MODE') return 'mock';
      return fallback;
    }),
  };

  let service: DeploymentRunnerService;

  beforeEach(() => {
    service = new DeploymentRunnerService(mockConfig as never);
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;
  });

  it('fails staging test for broken version marker', async () => {
    const logs: string[] = [];
    const report = await service.runStagingTests({
      updateId: 'u1',
      version: '1.0.0-broken',
      onLog: (entry) => {
        logs.push(entry.message);
      },
    });

    expect(report.passed).toBe(false);
    expect(report.error).toContain('broken');
  });

  it('fails canary for high-errors version marker', async () => {
    const metrics = await service.runCanaryMonitor({
      updateId: 'u1',
      version: '1.0.0-high-errors',
      onLog: jest.fn(),
    });

    expect(metrics.passed).toBe(false);
    expect(metrics.errorRate).toBeGreaterThan(0.05);
  });
});

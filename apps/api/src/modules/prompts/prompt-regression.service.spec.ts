import { PromptRegressionService } from './prompt-regression.service';
import { evaluateAssertions } from '../quality/utils/assertion-evaluator';

describe('PromptRegressionService', () => {
  const mockPrisma = {
    promptRegressionCase: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    promptRegressionRun: { create: jest.fn(), findMany: jest.fn() },
    source: { findFirst: jest.fn() },
  };

  const mockPlayground = { test: jest.fn() };
  const mockPrompts = { getActive: jest.fn() };

  let service: PromptRegressionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PromptRegressionService(
      mockPrisma as never,
      mockPlayground as never,
      mockPrompts as never,
    );
  });

  it('evaluates regression assertions via shared evaluator', () => {
    const result = evaluateAssertions('Мы работаем каждый день', {
      mustContain: ['работаем'],
      mustNotContain: ['оператор'],
    });
    expect(result.passed).toBe(true);
  });

  it('runs all active cases and stores results', async () => {
    mockPrisma.source.findFirst.mockResolvedValue({ id: 's1' });
    mockPrompts.getActive.mockResolvedValue({ id: 'p1' });
    mockPrisma.promptRegressionCase.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'Greeting',
        userMessage: 'Привет',
        assertionsJson: { minLength: 3 },
      },
    ]);
    mockPlayground.test.mockResolvedValue({ content: 'Здравствуйте!' });
    mockPrisma.promptRegressionRun.create.mockResolvedValue({
      id: 'r1',
      tenantId: 't1',
      sourceId: 's1',
      promptId: 'p1',
      passed: 1,
      failed: 0,
      resultsJson: [],
      createdAt: new Date('2026-08-06T12:00:00Z'),
    });

    const result = await service.runAll('t1', {
      sourceId: 's1',
      clientPrompt: 'Ты консультант',
    });

    expect(result.passed).toBe(1);
    expect(mockPlayground.test).toHaveBeenCalledWith(
      expect.objectContaining({ skipQuota: true }),
    );
  });
});

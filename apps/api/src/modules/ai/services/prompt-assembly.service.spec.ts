import { PromptAssemblyService } from './prompt-assembly.service';

describe('PromptAssemblyService', () => {
  const mockPrisma = {
    prompt: {
      findFirst: jest.fn(),
    },
  };

  let service: PromptAssemblyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PromptAssemblyService(mockPrisma as never, {
      get: () => '',
    } as never);
  });

  it('stacks platform → client → RAG (no hidden persona rules)', async () => {
    mockPrisma.prompt.findFirst
      .mockResolvedValueOnce({ content: 'Правила платформы' })
      .mockResolvedValueOnce({ content: 'Правила клиента' });

    const result = await service.assemble({
      tenantId: 't1',
      ragContext: 'Факт из KB',
      fallbackClientPrompt: 'fallback',
    });

    const platformIdx = result.systemContent.indexOf('[Платформа]');
    const clientIdx = result.systemContent.indexOf('[Клиент]');
    const ragIdx = result.systemContent.indexOf('[База знаний]');

    expect(platformIdx).toBeGreaterThanOrEqual(0);
    expect(platformIdx).toBeLessThan(clientIdx);
    expect(clientIdx).toBeLessThan(ragIdx);
    expect(result.systemContent).toContain('Правила платформы');
    expect(result.systemContent).toContain('Правила клиента');
    expect(result.systemContent).not.toContain('[Стиль общения]');
    expect(result.systemContent).not.toContain('[ПРИОРИТЕТ');
  });

  it('omits empty sections to save tokens', async () => {
    mockPrisma.prompt.findFirst.mockResolvedValue(null);

    const result = await service.assemble({
      tenantId: 't1',
      ragContext: '',
    });

    expect(result.systemContent).toBe('');
    expect(result.estimatedChars).toBe(0);
  });

  it('truncates long RAG context', async () => {
    mockPrisma.prompt.findFirst.mockResolvedValue(null);

    const result = await service.assemble({
      tenantId: 't1',
      ragContext: 'x'.repeat(5000),
    });

    expect(result.systemContent.length).toBeLessThan(5000);
    expect(result.systemContent.endsWith('…')).toBe(true);
  });
});

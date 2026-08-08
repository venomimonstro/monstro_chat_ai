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

  it('stacks platform → client → behavior → RAG → mode', async () => {
    mockPrisma.prompt.findFirst
      .mockResolvedValueOnce({ content: 'Правила платформы' })
      .mockResolvedValueOnce({ content: 'Правила клиента' });

    const result = await service.assemble({
      tenantId: 't1',
      ragContext: 'Факт из KB',
      fallbackClientPrompt: 'fallback',
      personaInstruction: 'Стиль менеджера',
      knowledgeMode: 'hybrid',
      ragSufficient: true,
    });

    const platformIdx = result.systemContent.indexOf('[Платформа]');
    const clientIdx = result.systemContent.indexOf('[Клиент]');
    const behaviorIdx = result.systemContent.indexOf('[Поведение]');
    const ragIdx = result.systemContent.indexOf('[База знаний]');
    const modeIdx = result.systemContent.indexOf('[Режим:');

    expect(platformIdx).toBeGreaterThanOrEqual(0);
    expect(platformIdx).toBeLessThan(clientIdx);
    expect(clientIdx).toBeLessThan(behaviorIdx);
    expect(behaviorIdx).toBeLessThan(ragIdx);
    expect(ragIdx).toBeLessThan(modeIdx);
    expect(result.systemContent).toContain('Правила платформы');
    expect(result.systemContent).toContain('Правила клиента');
    expect(result.systemContent).toContain('Стиль менеджера');
    expect(result.systemContent).not.toContain('[Стиль общения]');
    expect(result.systemContent).not.toContain('[ПРИОРИТЕТ');
  });

  it('omits empty sections to save tokens', async () => {
    mockPrisma.prompt.findFirst.mockResolvedValue(null);

    const result = await service.assemble({
      tenantId: 't1',
      ragContext: '',
      knowledgeMode: 'hybrid',
      ragSufficient: false,
    });

    expect(result.systemContent).toContain('[Режим:');
    expect(result.systemContent).not.toMatch(/\[База знаний\]\n/);
  });

  it('truncates long RAG context', async () => {
    mockPrisma.prompt.findFirst.mockResolvedValue(null);

    const result = await service.assemble({
      tenantId: 't1',
      ragContext: 'x'.repeat(5000),
      knowledgeMode: 'hybrid',
    });

    expect(result.systemContent.length).toBeLessThan(5200);
    expect(result.systemContent).toContain('[База знаний]');
    expect(result.systemContent).toMatch(/x{100,}…/);
  });
});

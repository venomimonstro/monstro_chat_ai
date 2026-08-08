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
      get: () => 'GLOBAL RULES',
    } as never);
  });

  it('places global prompt after client prompt with priority label', async () => {
    mockPrisma.prompt.findFirst.mockResolvedValue(null);

    const result = await service.assemble({
      tenantId: 't1',
      ragContext: 'Test context',
      fallbackClientPrompt: 'Client rules',
    });

    const personaIdx = result.systemContent.indexOf('[Стиль общения]');
    const clientIdx = result.systemContent.indexOf('[Инструкции клиента]');
    const ragIdx = result.systemContent.indexOf('[Контекст из базы знаний]');
    const globalIdx = result.systemContent.indexOf('[ПРИОРИТЕТ');

    expect(personaIdx).toBeGreaterThanOrEqual(0);
    expect(personaIdx).toBeLessThan(clientIdx);
    expect(clientIdx).toBeLessThan(ragIdx);
    expect(ragIdx).toBeLessThan(globalIdx);
    expect(result.systemContent).toContain('наивысший приоритет');
    expect(result.systemContent).toContain('GLOBAL RULES');
    expect(result.systemContent).toContain('не предлагай «передать менеджеру»');
  });

  it('applies persona config from source', async () => {
    mockPrisma.prompt.findFirst.mockResolvedValue(null);

    const result = await service.assemble({
      tenantId: 't1',
      ragContext: 'Test context',
      personaConfig: {
        personaStyle: 'expert',
        objectionHandling: 'empathy_first',
      },
    });

    expect(result.systemContent).toContain('эксперт');
    expect(result.systemContent).toContain('понимание');
  });

  it('adds hybrid AI manager instruction by default', async () => {
    mockPrisma.prompt.findFirst.mockResolvedValue(null);

    const result = await service.assemble({
      tenantId: 't1',
      ragContext: 'Test context',
      knowledgeMode: 'hybrid',
    });

    expect(result.systemContent).toContain('[Режим AI-менеджера]');
    expect(result.systemContent).toContain('не скрипт');
  });

  it('adds insufficient-context instruction when flagged in strict mode', async () => {
    mockPrisma.prompt.findFirst.mockResolvedValue(null);

    const result = await service.assemble({
      tenantId: 't1',
      ragContext: 'empty',
      insufficientContext: true,
      knowledgeMode: 'strict_kb',
    });

    expect(result.systemContent).toContain('[Недостаточно знаний]');
    expect(result.systemContent).toContain('Не выдумывай');
  });

  it('adds soft insufficient instruction in hybrid mode', async () => {
    mockPrisma.prompt.findFirst.mockResolvedValue(null);

    const result = await service.assemble({
      tenantId: 't1',
      ragContext: 'empty',
      insufficientContext: true,
      knowledgeMode: 'hybrid',
    });

    expect(result.systemContent).toContain('[Мало данных в базе]');
    expect(result.systemContent).toContain('уточняющих');
  });
});

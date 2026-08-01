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

    const clientIdx = result.systemContent.indexOf('[Инструкции клиента]');
    const ragIdx = result.systemContent.indexOf('[Контекст из базы знаний]');
    const globalIdx = result.systemContent.indexOf('[ПРИОРИТЕТ');

    expect(clientIdx).toBeLessThan(ragIdx);
    expect(ragIdx).toBeLessThan(globalIdx);
    expect(result.systemContent).toContain('наивысший приоритет');
    expect(result.systemContent).toContain('GLOBAL RULES');
  });
});

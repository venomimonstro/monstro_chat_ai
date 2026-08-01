import { PromptExperimentService } from './prompt-experiment.service';

describe('PromptExperimentService', () => {
  const mockPrisma = {
    promptExperiment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    prompt: { findFirst: jest.fn() },
    dialogExperimentAssignment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  let service: PromptExperimentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PromptExperimentService(mockPrisma as never);
  });

  it('assigns variant B based on traffic percent', async () => {
    mockPrisma.promptExperiment.findFirst.mockResolvedValue({
      id: 'exp1',
      trafficBPercent: 100,
      promptA: { content: 'A' },
      promptB: { content: 'B' },
    });
    mockPrisma.dialogExperimentAssignment.findUnique.mockResolvedValue(null);
    mockPrisma.dialogExperimentAssignment.create.mockResolvedValue({});

    const prompt = await service.resolveClientPrompt('t1', 'd1');
    expect(prompt).toBe('B');
  });

  it('marks dialog as converted', async () => {
    mockPrisma.dialogExperimentAssignment.updateMany.mockResolvedValue({ count: 1 });
    await service.markConverted('d1');
    expect(mockPrisma.dialogExperimentAssignment.updateMany).toHaveBeenCalled();
  });
});

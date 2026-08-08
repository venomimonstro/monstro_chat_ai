import {
  lexicalOverlapScore,
  RetrievalService,
} from './retrieval.service';

describe('lexicalOverlapScore', () => {
  it('scores overlapping tokens', () => {
    expect(
      lexicalOverlapScore('цена тарифа', 'наш тарифа и цена'),
    ).toBeGreaterThanOrEqual(0.5);
  });

  it('returns 0 when no overlap', () => {
    expect(lexicalOverlapScore('доставка', 'о компании')).toBe(0);
  });
});

describe('RetrievalService', () => {
  const mockPrisma = {
    $queryRawUnsafe: jest.fn(),
  };
  const mockEmbedding = {
    embedBatch: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  };

  let service: RetrievalService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RetrievalService(mockPrisma as never, mockEmbedding as never, {
      get: (key: string, def?: unknown) => {
        if (key === 'RAG_TOP_K') return 2;
        if (key === 'RAG_CANDIDATE_K') return 5;
        if (key === 'RAG_SIMILARITY_THRESHOLD') return 0.58;
        if (key === 'RAG_SOFT_THRESHOLD') return 0.42;
        return def;
      },
    } as never);
  });

  it('filters by threshold and reranks by combined score', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        id: 'low',
        content: 'случайный текст',
        metadata_json: {},
        similarity: 0.4,
        document_title: 'A',
        document_url: null,
      },
      {
        id: 'high',
        content: 'стоимость тарифа и цена подключения',
        metadata_json: {},
        similarity: 0.85,
        document_title: 'Цены',
        document_url: null,
      },
      {
        id: 'mid',
        content: 'тариф базовый',
        metadata_json: {},
        similarity: 0.74,
        document_title: 'Тарифы',
        document_url: null,
      },
    ]);

    const result = await service.search('t1', 's1', 'цена тарифа');

    expect(result.sufficient).toBe(true);
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks.every((c) => c.similarity >= 0.58)).toBe(true);
    expect(result.chunks[0].id).toBe('high');
    expect(result.maxSimilarity).toBeCloseTo(0.85);
  });

  it('returns empty context when no candidates', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const result = await service.search('t1', 's1', 'цена');
    expect(result.sufficient).toBe(false);
    expect(result.chunks).toHaveLength(0);
    expect(service.formatRagContext(result)).toBe('');
  });

  it('uses best candidates when below threshold', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        id: 'soft',
        content: 'тарифы и цены',
        metadata_json: {},
        similarity: 0.5,
        document_title: 'Цены',
        document_url: null,
      },
    ]);

    const result = await service.search('t1', 's1', 'цена');
    const ctx = service.formatRagContext(result);
    expect(ctx).toContain('Цены');
    expect(ctx).toContain('тарифы');
  });

  it('builds diagnostic payload', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        id: 'ok',
        content: 'x'.repeat(500),
        metadata_json: {},
        similarity: 0.9,
        document_title: 'Doc',
        document_url: 'https://x.test',
      },
    ]);

    const result = await service.search('t1', 's1', 'вопрос');
    const diag = service.toDiagnostic(result);
    expect(diag.sufficient).toBe(true);
    expect(diag.chunks[0].content.length).toBeLessThanOrEqual(400);
    expect(diag.threshold).toBe(0.58);
  });

  it('includes soft chunks when nothing passes threshold (hybrid mode)', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        id: 'soft',
        content: 'тарифы и подключение',
        metadata_json: {},
        similarity: 0.5,
        document_title: 'Тарифы',
        document_url: null,
      },
    ]);

    const result = await service.search('t1', 's1', 'цена');
    expect(result.sufficient).toBe(false);
    expect(result.softChunks).toHaveLength(1);
    const ctx = service.formatRagContext(result, { knowledgeMode: 'hybrid' });
    expect(ctx).toContain('Тарифы');
    expect(ctx).toContain('тарифы');
  });

  it('strict_kb mode ignores soft chunks', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        id: 'soft',
        content: 'тарифы',
        metadata_json: {},
        similarity: 0.5,
        document_title: null,
        document_url: null,
      },
    ]);

    const result = await service.search('t1', 's1', 'цена');
    expect(service.formatRagContext(result, { knowledgeMode: 'strict_kb' })).toBe(
      '',
    );
  });
});

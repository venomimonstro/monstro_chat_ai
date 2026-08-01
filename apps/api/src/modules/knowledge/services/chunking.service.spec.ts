import { Test, TestingModule } from '@nestjs/testing';
import { ChunkingService } from './chunking.service';

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChunkingService],
    }).compile();
    service = module.get(ChunkingService);
  });

  it('returns empty array for empty text', () => {
    expect(service.chunkText('   ')).toEqual([]);
  });

  it('returns single chunk for short text', () => {
    const text = 'Короткий текст для теста.';
    expect(service.chunkText(text)).toEqual([text]);
  });

  it('splits long text into multiple chunks with overlap', () => {
    const paragraph = 'word '.repeat(2000).trim();
    const chunks = service.chunkText(paragraph);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => expect(chunk.length).toBeGreaterThan(0));
  });
});

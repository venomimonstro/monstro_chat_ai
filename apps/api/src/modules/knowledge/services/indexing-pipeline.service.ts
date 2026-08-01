import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';

@Injectable()
export class IndexingPipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chunking: ChunkingService,
    private readonly embedding: EmbeddingService,
  ) {}

  async indexDocumentContent(
    tenantId: string,
    documentId: string,
    text: string,
    metadata: Record<string, unknown> = {},
  ): Promise<number> {
    await this.prisma.knowledgeChunk.deleteMany({ where: { documentId } });

    const chunks = this.chunking.chunkText(text);
    if (chunks.length === 0) return 0;

    const embeddings = await this.embedding.embedBatch(chunks);

    for (let i = 0; i < chunks.length; i++) {
      const id = randomUUID();
      const vectorStr = `[${embeddings[i].join(',')}]`;
      const metaJson = JSON.stringify({ ...metadata, chunkIndex: i });

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO knowledge_chunks (id, tenant_id, document_id, content, chunk_index, metadata_json, embedding)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7::vector)`,
        id,
        tenantId,
        documentId,
        chunks[i],
        i,
        metaJson,
        vectorStr,
      );
    }

    return chunks.length;
  }
}

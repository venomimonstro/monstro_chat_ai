import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingService } from '../../knowledge/services/embedding.service';
import { RAG_TOP_K } from '../constants';

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  async searchSimilar(
    tenantId: string,
    sourceId: string,
    query: string,
    topK = RAG_TOP_K,
  ): Promise<RetrievedChunk[]> {
    const [embedding] = await this.embedding.embedBatch([query]);
    const vectorStr = `[${embedding.join(',')}]`;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        content: string;
        metadata_json: Record<string, unknown>;
        similarity: number;
      }>
    >(
      `SELECT kc.id, kc.content, kc.metadata_json,
              1 - (kc.embedding <=> $1::vector) AS similarity
       FROM knowledge_chunks kc
       INNER JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kc.tenant_id = $2::uuid
         AND kd.source_id = $3::uuid
         AND kd.status = 'completed'
         AND kc.embedding IS NOT NULL
       ORDER BY kc.embedding <=> $1::vector
       LIMIT $4`,
      vectorStr,
      tenantId,
      sourceId,
      topK,
    );

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      similarity: Number(row.similarity),
      metadata: row.metadata_json ?? {},
    }));
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingService } from '../../knowledge/services/embedding.service';
import {
  DEFAULT_RAG_CANDIDATE_K,
  DEFAULT_RAG_SIMILARITY_THRESHOLD,
  DEFAULT_RAG_TOP_K,
  RAG_TOP_K,
} from '../constants';

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
  /** Combined score after lightweight rerank (vector + lexical). */
  score: number;
  metadata: Record<string, unknown>;
  documentTitle?: string | null;
  documentUrl?: string | null;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  candidates: RetrievedChunk[];
  maxSimilarity: number;
  threshold: number;
  topK: number;
  candidateK: number;
  sufficient: boolean;
  query: string;
}

@Injectable()
export class RetrievalService {
  private readonly topK: number;
  private readonly candidateK: number;
  private readonly threshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
    config: ConfigService,
  ) {
    this.topK = Number(config.get('RAG_TOP_K', DEFAULT_RAG_TOP_K)) || DEFAULT_RAG_TOP_K;
    this.candidateK =
      Number(config.get('RAG_CANDIDATE_K', DEFAULT_RAG_CANDIDATE_K)) ||
      DEFAULT_RAG_CANDIDATE_K;
    this.threshold =
      Number(
        config.get(
          'RAG_SIMILARITY_THRESHOLD',
          DEFAULT_RAG_SIMILARITY_THRESHOLD,
        ),
      ) || DEFAULT_RAG_SIMILARITY_THRESHOLD;
  }

  /** Backward-compatible: returns filtered+reranked top chunks. */
  async searchSimilar(
    tenantId: string,
    sourceId: string,
    query: string,
    topK = RAG_TOP_K,
  ): Promise<RetrievedChunk[]> {
    const result = await this.search(tenantId, sourceId, query, { topK });
    return result.chunks;
  }

  async search(
    tenantId: string,
    sourceId: string,
    query: string,
    options?: { topK?: number; candidateK?: number; threshold?: number },
  ): Promise<RetrievalResult> {
    const topK = options?.topK ?? this.topK;
    const candidateK = Math.max(options?.candidateK ?? this.candidateK, topK);
    const threshold = options?.threshold ?? this.threshold;

    const [embedding] = await this.embedding.embedBatch([query]);
    const vectorStr = `[${embedding.join(',')}]`;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        content: string;
        metadata_json: Record<string, unknown>;
        similarity: number;
        document_title: string | null;
        document_url: string | null;
      }>
    >(
      `SELECT kc.id, kc.content, kc.metadata_json,
              1 - (kc.embedding <=> $1::vector) AS similarity,
              kd.title AS document_title,
              kd.url AS document_url
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
      candidateK,
    );

    const candidates = rows.map((row) => {
      const similarity = Number(row.similarity);
      const lexical = lexicalOverlapScore(query, row.content);
      // Vector dominates; lexical bump helps near-ties and keyword matches.
      const score = similarity * 0.85 + lexical * 0.15;
      return {
        id: row.id,
        content: row.content,
        similarity,
        score,
        metadata: row.metadata_json ?? {},
        documentTitle: row.document_title,
        documentUrl: row.document_url,
      };
    });

    const reranked = [...candidates].sort((a, b) => b.score - a.score);
    const aboveThreshold = reranked.filter((c) => c.similarity >= threshold);
    const chunks = aboveThreshold.slice(0, topK);
    const maxSimilarity =
      candidates.length > 0
        ? Math.max(...candidates.map((c) => c.similarity))
        : 0;

    return {
      chunks,
      candidates: reranked,
      maxSimilarity,
      threshold,
      topK,
      candidateK,
      sufficient: chunks.length > 0,
      query,
    };
  }

  formatRagContext(result: RetrievalResult): string {
    const chunks =
      result.chunks.length > 0
        ? result.chunks
        : result.candidates.slice(0, 2);

    if (chunks.length === 0) {
      return '';
    }

    return chunks
      .map((c, i) => {
        const label = c.documentTitle ?? c.documentUrl ?? `фрагмент ${i + 1}`;
        return `${label}: ${c.content.replace(/\s+/g, ' ').trim()}`;
      })
      .join('\n');
  }

  toDiagnostic(result: RetrievalResult) {
    return {
      query: result.query,
      sufficient: result.sufficient,
      maxSimilarity: round4(result.maxSimilarity),
      threshold: result.threshold,
      topK: result.topK,
      candidateK: result.candidateK,
      selectedCount: result.chunks.length,
      candidateCount: result.candidates.length,
      chunks: result.chunks.map((c) => ({
        id: c.id,
        content: c.content.slice(0, 400),
        similarity: round4(c.similarity),
        score: round4(c.score),
        documentTitle: c.documentTitle ?? null,
        documentUrl: c.documentUrl ?? null,
      })),
      rejected: result.candidates
        .filter((c) => c.similarity < result.threshold)
        .slice(0, 5)
        .map((c) => ({
          id: c.id,
          content: c.content.slice(0, 200),
          similarity: round4(c.similarity),
          score: round4(c.score),
          documentTitle: c.documentTitle ?? null,
        })),
    };
  }
}

/** Exported for unit tests. */
export function lexicalOverlapScore(query: string, content: string): number {
  const qTokens = tokenize(query);
  if (qTokens.size === 0) return 0;
  const cTokens = tokenize(content);
  let hits = 0;
  for (const token of qTokens) {
    if (cTokens.has(token)) hits += 1;
  }
  return hits / qTokens.size;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

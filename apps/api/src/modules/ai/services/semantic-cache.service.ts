import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingService } from '../../knowledge/services/embedding.service';

export interface CacheLookupResult {
  id: string;
  answer: string;
  provider: string | null;
  model: string | null;
  similarity: number;
}

@Injectable()
export class SemanticCacheService {
  private readonly logger = new Logger(SemanticCacheService.name);
  private readonly similarityThreshold: number;
  private readonly ttlHours: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
    config: ConfigService,
  ) {
    this.similarityThreshold = config.get<number>(
      'SEMANTIC_CACHE_THRESHOLD',
      0.92,
    );
    this.ttlHours = config.get<number>('SEMANTIC_CACHE_TTL_HOURS', 168);
  }

  async lookup(
    tenantId: string,
    question: string,
  ): Promise<CacheLookupResult | null> {
    const [embedding] = await this.embedding.embedBatch([question]);
    const vectorStr = `[${embedding.join(',')}]`;
    const now = new Date();

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        answer: string;
        provider: string | null;
        model: string | null;
        similarity: number;
      }>
    >(
      `SELECT id, answer, provider, model,
              1 - (embedding <=> $1::vector) AS similarity
       FROM semantic_cache_entries
       WHERE tenant_id = $2::uuid
         AND expires_at > $3
         AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT 1`,
      vectorStr,
      tenantId,
      now,
    );

    const hit = rows[0];
    if (!hit || Number(hit.similarity) < this.similarityThreshold) {
      return null;
    }

    await this.prisma.semanticCacheEntry.update({
      where: { id: hit.id },
      data: { hitCount: { increment: 1 } },
    });

    return {
      id: hit.id,
      answer: hit.answer,
      provider: hit.provider,
      model: hit.model,
      similarity: Number(hit.similarity),
    };
  }

  async hasSimilar(tenantId: string, question: string): Promise<boolean> {
    const hit = await this.lookup(tenantId, question);
    return hit !== null;
  }

  async store(
    tenantId: string,
    question: string,
    answer: string,
    provider?: string,
    model?: string,
  ) {
    const [embedding] = await this.embedding.embedBatch([question]);
    const vectorStr = `[${embedding.join(',')}]`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.ttlHours);

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO semantic_cache_entries
        (id, tenant_id, question, answer, provider, model, hit_count, embedding, expires_at, created_at, updated_at)
       VALUES (
         gen_random_uuid(),
         $1::uuid,
         $2,
         $3,
         $4,
         $5,
         0,
         $6::vector,
         $7,
         NOW(),
         NOW()
       )`,
      tenantId,
      question,
      answer,
      provider ?? null,
      model ?? null,
      vectorStr,
      expiresAt,
    );
  }

  async getHitCount(tenantId: string, from: Date, to: Date): Promise<number> {
    const result = await this.prisma.semanticCacheEntry.aggregate({
      where: {
        tenantId,
        updatedAt: { gte: from, lte: to },
        hitCount: { gt: 0 },
      },
      _sum: { hitCount: true },
    });
    return result._sum.hitCount ?? 0;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpired() {
    const deleted = await this.prisma.semanticCacheEntry.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (deleted.count > 0) {
      this.logger.log(`Purged ${deleted.count} expired semantic cache entries`);
    }
  }
}

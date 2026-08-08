import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { EMBEDDING_DIMENSIONS } from '../constants';
import { ProviderCredentialsService } from '../../ai/services/provider-credentials.service';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => ProviderCredentialsService))
    private readonly llmCredentials: ProviderCredentialsService,
  ) {}

  async embedBatch(texts: string[]): Promise<number[][]> {
    const apiKey =
      this.llmCredentials.getEffectiveKey('openai') ??
      this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY не задан (ни в админке, ни в env) — mock embeddings для RAG',
      );
      return texts.map((text) => this.mockEmbedding(text));
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.get('EMBEDDING_MODEL', 'text-embedding-3-small'),
          input: texts,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(`Embedding API error: ${body}`);
        return texts.map((text) => this.mockEmbedding(text));
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>;
      };
      return data.data.map((item) => item.embedding);
    } catch (error) {
      this.logger.warn(`Embedding fetch failed: ${String(error)}`);
      return texts.map((text) => this.mockEmbedding(text));
    }
  }

  mockEmbedding(text: string): number[] {
    const hash = createHash('sha256').update(text).digest();
    const vector: number[] = [];

    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      const byte = hash[i % hash.length];
      vector.push((byte / 255) * 2 - 1);
    }

    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / norm);
  }
}

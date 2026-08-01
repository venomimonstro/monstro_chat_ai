import { Injectable } from '@nestjs/common';
import { encode, decode } from 'gpt-tokenizer';
import { CHUNK_TOKEN_OVERLAP, CHUNK_TOKEN_SIZE } from '../constants';

@Injectable()
export class ChunkingService {
  chunkText(text: string): string[] {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];

    const tokens = encode(normalized);
    if (tokens.length <= CHUNK_TOKEN_SIZE) {
      return [normalized];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < tokens.length) {
      const end = Math.min(start + CHUNK_TOKEN_SIZE, tokens.length);
      const slice = tokens.slice(start, end);
      chunks.push(decode(slice).trim());

      if (end >= tokens.length) break;
      start = Math.max(0, end - CHUNK_TOKEN_OVERLAP);
    }

    return chunks.filter(Boolean);
  }
}

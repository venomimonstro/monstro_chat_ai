import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { PromptScope } from '@prisma/client';
import {
  PROMPT_BUDGET,
  truncatePromptSection,
} from '../utils/prompt-budget.util';

export interface AssembledPrompt {
  systemContent: string;
  clientPrompt: string;
  globalPrompt: string;
  estimatedChars: number;
}

/**
 * Prompt stack (token-optimized):
 * 1. Platform super-prompt (admin, global scope in DB)
 * 2. Client prompt (tenant DB or source config)
 * 3. RAG context (truncated)
 * 4. Dialog summary / lead (compact)
 * 5. API security note (1 line, only if injection suspected)
 */
@Injectable()
export class PromptAssemblyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getActivePrompt(
    scope: PromptScope,
    tenantId?: string,
  ): Promise<string | null> {
    const prompt = await this.prisma.prompt.findFirst({
      where: {
        scope,
        isActive: true,
        ...(scope === 'tenant' ? { tenantId } : { tenantId: null }),
      },
      orderBy: { version: 'desc' },
    });
    return prompt?.content ?? null;
  }

  async assemble(params: {
    tenantId: string;
    ragContext: string;
    dialogSummary?: string | null;
    fallbackClientPrompt?: string;
    clientPromptOverride?: string | null;
    antiInjectionInstruction?: string | null;
    leadGoalInstruction?: string | null;
  }): Promise<AssembledPrompt> {
    const dbClient = await this.getActivePrompt('tenant', params.tenantId);
    const clientPrompt = truncatePromptSection(
      params.clientPromptOverride?.trim() ||
        dbClient?.trim() ||
        params.fallbackClientPrompt?.trim() ||
        '',
      PROMPT_BUDGET.CLIENT_FALLBACK_CHARS,
    );

    const dbGlobal = await this.getActivePrompt('global');
    const envFallback = this.config.get<string>('GLOBAL_SYSTEM_PROMPT', '');
    const globalPrompt = dbGlobal?.trim() || envFallback.trim();

    const parts: string[] = [];

    if (globalPrompt) {
      parts.push(`[Платформа]\n${globalPrompt}`);
    }

    if (clientPrompt) {
      parts.push(`[Клиент]\n${clientPrompt}`);
    }

    const rag = truncatePromptSection(
      params.ragContext,
      PROMPT_BUDGET.RAG_CHARS,
    );
    if (rag) {
      parts.push(`[База знаний]\n${rag}`);
    }

    if (params.dialogSummary?.trim()) {
      parts.push(
        `[Контекст диалога]\n${truncatePromptSection(params.dialogSummary, PROMPT_BUDGET.SUMMARY_CHARS)}`,
      );
    }

    if (params.leadGoalInstruction?.trim()) {
      parts.push(
        truncatePromptSection(
          params.leadGoalInstruction,
          PROMPT_BUDGET.LEAD_CHARS,
        ),
      );
    }

    if (params.antiInjectionInstruction?.trim()) {
      parts.push(params.antiInjectionInstruction.trim());
    }

    const systemContent = parts.join('\n\n');

    return {
      systemContent,
      clientPrompt,
      globalPrompt,
      estimatedChars: systemContent.length,
    };
  }
}

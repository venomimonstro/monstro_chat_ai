import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlaygroundService } from './playground.service';
import { PromptsService } from './prompts.service';
import { evaluateAssertions } from '../quality/utils/assertion-evaluator';
import type { PromptRegressionAssertions } from '@ai-consultant/shared-types';
import type {
  CreateRegressionCaseDto,
  UpdateRegressionCaseDto,
} from './dto/prompt-regression.dto';

@Injectable()
export class PromptRegressionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playground: PlaygroundService,
    private readonly prompts: PromptsService,
  ) {}

  async listCases(tenantId: string, sourceId?: string) {
    const cases = await this.prisma.promptRegressionCase.findMany({
      where: {
        tenantId,
        ...(sourceId ? { OR: [{ sourceId }, { sourceId: null }] } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return cases.map((c) => this.toDto(c));
  }

  async createCase(tenantId: string, dto: CreateRegressionCaseDto) {
    if (dto.sourceId) {
      await this.assertSource(tenantId, dto.sourceId);
    }
    const created = await this.prisma.promptRegressionCase.create({
      data: {
        tenantId,
        sourceId: dto.sourceId ?? null,
        name: dto.name,
        userMessage: dto.userMessage,
        assertionsJson: (dto.assertions ?? {}) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toDto(created);
  }

  async updateCase(
    tenantId: string,
    id: string,
    dto: UpdateRegressionCaseDto,
  ) {
    await this.getCaseOrThrow(tenantId, id);
    if (dto.sourceId) {
      await this.assertSource(tenantId, dto.sourceId);
    }
    const updated = await this.prisma.promptRegressionCase.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.userMessage !== undefined ? { userMessage: dto.userMessage } : {}),
        ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId } : {}),
        ...(dto.assertions !== undefined
          ? { assertionsJson: dto.assertions as Prisma.InputJsonValue }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toDto(updated);
  }

  async deleteCase(tenantId: string, id: string) {
    await this.getCaseOrThrow(tenantId, id);
    await this.prisma.promptRegressionCase.delete({ where: { id } });
    return { ok: true };
  }

  async runAll(
    tenantId: string,
    params: { sourceId: string; clientPrompt: string },
  ) {
    await this.assertSource(tenantId, params.sourceId);

    const activePrompt = await this.prompts.getActive(tenantId, 'tenant');
    const cases = await this.prisma.promptRegressionCase.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [{ sourceId: params.sourceId }, { sourceId: null }],
      },
      orderBy: { createdAt: 'asc' },
    });

    const results = [];
    let passed = 0;
    let failed = 0;

    for (const testCase of cases) {
      const response = await this.playground.test({
        tenantId,
        sourceId: params.sourceId,
        message: testCase.userMessage,
        clientPrompt: params.clientPrompt,
        skipQuota: true,
      });

      const assertions = testCase.assertionsJson as PromptRegressionAssertions;
      const evaluation = evaluateAssertions(response.content, assertions);
      if (evaluation.passed) passed += 1;
      else failed += 1;

      results.push({
        caseId: testCase.id,
        caseName: testCase.name,
        passed: evaluation.passed,
        response: response.content,
        failures: evaluation.failures,
      });
    }

    const run = await this.prisma.promptRegressionRun.create({
      data: {
        tenantId,
        sourceId: params.sourceId,
        promptId: activePrompt?.id ?? null,
        passed,
        failed,
        resultsJson: results,
      },
    });

    return {
      id: run.id,
      tenantId: run.tenantId,
      sourceId: run.sourceId,
      promptId: run.promptId,
      passed: run.passed,
      failed: run.failed,
      results,
      createdAt: run.createdAt.toISOString(),
    };
  }

  async listRuns(tenantId: string, limit = 20) {
    const runs = await this.prisma.promptRegressionRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
    });
    return runs.map((run) => ({
      id: run.id,
      tenantId: run.tenantId,
      sourceId: run.sourceId,
      promptId: run.promptId,
      passed: run.passed,
      failed: run.failed,
      results: run.resultsJson as unknown[],
      createdAt: run.createdAt.toISOString(),
    }));
  }

  private async getCaseOrThrow(tenantId: string, id: string) {
    const row = await this.prisma.promptRegressionCase.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Тест-кейс не найден');
    return row;
  }

  private async assertSource(tenantId: string, sourceId: string) {
    const source = await this.prisma.source.findFirst({
      where: { id: sourceId, tenantId },
    });
    if (!source) throw new NotFoundException('Источник не найден');
  }

  private toDto(row: {
    id: string;
    tenantId: string;
    sourceId: string | null;
    name: string;
    userMessage: string;
    assertionsJson: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      sourceId: row.sourceId,
      name: row.name,
      userMessage: row.userMessage,
      assertions: row.assertionsJson as PromptRegressionAssertions,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

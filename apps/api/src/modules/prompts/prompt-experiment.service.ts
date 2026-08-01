import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreatePromptExperimentDto,
  PromptExperimentDto,
  PromptExperimentReportDto,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptExperimentStatus } from '@prisma/client';

@Injectable()
export class PromptExperimentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<PromptExperimentDto[]> {
    const rows = await this.prisma.promptExperiment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async create(tenantId: string, dto: CreatePromptExperimentDto) {
    if (dto.promptAId === dto.promptBId) {
      throw new BadRequestException('Варианты A и B должны отличаться');
    }

    const [promptA, promptB] = await Promise.all([
      this.prisma.prompt.findFirst({
        where: { id: dto.promptAId, tenantId, scope: 'tenant' },
      }),
      this.prisma.prompt.findFirst({
        where: { id: dto.promptBId, tenantId, scope: 'tenant' },
      }),
    ]);
    if (!promptA || !promptB) {
      throw new NotFoundException('Промпт не найден');
    }

    const row = await this.prisma.promptExperiment.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        promptAId: dto.promptAId,
        promptBId: dto.promptBId,
        trafficBPercent: dto.trafficBPercent ?? 50,
        minSampleSize: dto.minSampleSize ?? 100,
        status: 'draft',
      },
    });
    return this.toDto(row);
  }

  async start(tenantId: string, id: string) {
    const experiment = await this.getOrThrow(tenantId, id);
    if (experiment.status === 'running') return this.toDto(experiment);

    await this.prisma.promptExperiment.updateMany({
      where: { tenantId, status: 'running', NOT: { id } },
      data: { status: 'paused', endedAt: new Date() },
    });

    const updated = await this.prisma.promptExperiment.update({
      where: { id },
      data: { status: 'running', startedAt: new Date(), endedAt: null },
    });
    return this.toDto(updated);
  }

  async pause(tenantId: string, id: string) {
    const experiment = await this.getOrThrow(tenantId, id);
    const updated = await this.prisma.promptExperiment.update({
      where: { id: experiment.id },
      data: { status: 'paused', endedAt: new Date() },
    });
    return this.toDto(updated);
  }

  async getReport(
    tenantId: string,
    id: string,
    periodDays = 7,
  ): Promise<PromptExperimentReportDto> {
    const experiment = await this.getOrThrow(tenantId, id);
    const since = new Date();
    since.setDate(since.getDate() - periodDays);

    const assignments = await this.prisma.dialogExperimentAssignment.findMany({
      where: {
        experimentId: experiment.id,
        createdAt: { gte: since },
      },
    });

    const variantA = assignments.filter((a) => a.variant === 'A');
    const variantB = assignments.filter((a) => a.variant === 'B');
    const leadsA = variantA.filter((a) => a.convertedToLead).length;
    const leadsB = variantB.filter((a) => a.convertedToLead).length;

    const rate = (leads: number, dialogs: number) =>
      dialogs > 0 ? Math.round((leads / dialogs) * 1000) / 10 : 0;

    return {
      experimentId: experiment.id,
      name: experiment.name,
      periodDays,
      variantA: {
        dialogs: variantA.length,
        leads: leadsA,
        conversionRate: rate(leadsA, variantA.length),
      },
      variantB: {
        dialogs: variantB.length,
        leads: leadsB,
        conversionRate: rate(leadsB, variantB.length),
      },
      minSampleSize: experiment.minSampleSize,
      sampleSizeReached:
        variantA.length + variantB.length >= experiment.minSampleSize,
    };
  }

  async resolveClientPrompt(
    tenantId: string,
    dialogId: string,
  ): Promise<string | null> {
    const experiment = await this.prisma.promptExperiment.findFirst({
      where: { tenantId, status: 'running' },
      include: { promptA: true, promptB: true },
    });
    if (!experiment) return null;

    const existing = await this.prisma.dialogExperimentAssignment.findUnique({
      where: { dialogId },
    });

    let variant = existing?.variant;
    if (!variant) {
      variant = Math.random() * 100 < experiment.trafficBPercent ? 'B' : 'A';
      await this.prisma.dialogExperimentAssignment.create({
        data: {
          experimentId: experiment.id,
          dialogId,
          variant,
        },
      });
    }

    return variant === 'B'
      ? experiment.promptB.content
      : experiment.promptA.content;
  }

  async markConverted(dialogId: string) {
    await this.prisma.dialogExperimentAssignment.updateMany({
      where: { dialogId, convertedToLead: false },
      data: { convertedToLead: true },
    });
  }

  private async getOrThrow(tenantId: string, id: string) {
    const row = await this.prisma.promptExperiment.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Эксперимент не найден');
    return row;
  }

  private toDto(row: {
    id: string;
    tenantId: string;
    name: string;
    promptAId: string;
    promptBId: string;
    trafficBPercent: number;
    status: PromptExperimentStatus;
    minSampleSize: number;
    startedAt: Date | null;
    endedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PromptExperimentDto {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      promptAId: row.promptAId,
      promptBId: row.promptBId,
      trafficBPercent: row.trafficBPercent,
      status: row.status,
      minSampleSize: row.minSampleSize,
      startedAt: row.startedAt?.toISOString() ?? null,
      endedAt: row.endedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

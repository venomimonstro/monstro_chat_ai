import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

const DEFAULT_STATUSES = [
  { name: 'Новый', color: '#3b82f6', sortOrder: 0 },
  { name: 'В работе', color: '#f59e0b', sortOrder: 1 },
  { name: 'Закрыт', color: '#22c55e', sortOrder: 2 },
];

@Injectable()
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultPipeline(tenantId: string) {
    const existing = await this.prisma.pipeline.findFirst({
      where: { tenantId, isDefault: true },
      include: { statuses: { orderBy: { sortOrder: 'asc' } } },
    });
    if (existing) return existing;

    return this.prisma.pipeline.create({
      data: {
        tenantId,
        name: 'Основная воронка',
        isDefault: true,
        statuses: { create: DEFAULT_STATUSES },
      },
      include: { statuses: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async list(tenantId: string) {
    await this.ensureDefaultPipeline(tenantId);
    const pipelines = await this.prisma.pipeline.findMany({
      where: { tenantId },
      include: { statuses: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });
    return pipelines.map((p) => this.toDto(p));
  }

  async create(tenantId: string, name: string) {
    const pipeline = await this.prisma.pipeline.create({
      data: {
        tenantId,
        name,
        statuses: { create: DEFAULT_STATUSES },
      },
      include: { statuses: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toDto(pipeline);
  }

  async update(tenantId: string, id: string, name: string) {
    await this.getOrThrow(tenantId, id);
    const pipeline = await this.prisma.pipeline.update({
      where: { id },
      data: { name },
      include: { statuses: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toDto(pipeline);
  }

  async createStatus(
    tenantId: string,
    pipelineId: string,
    data: { name: string; color?: string },
  ) {
    await this.getOrThrow(tenantId, pipelineId);
    const maxOrder = await this.prisma.pipelineStatus.aggregate({
      where: { pipelineId },
      _max: { sortOrder: true },
    });
    const status = await this.prisma.pipelineStatus.create({
      data: {
        pipelineId,
        name: data.name,
        color: data.color ?? '#64748b',
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
    return this.statusToDto(status);
  }

  async updateStatus(
    tenantId: string,
    statusId: string,
    data: { name?: string; color?: string; sortOrder?: number },
  ) {
    const status = await this.getStatusOrThrow(tenantId, statusId);
    const updated = await this.prisma.pipelineStatus.update({
      where: { id: status.id },
      data,
    });
    return this.statusToDto(updated);
  }

  async reorderStatuses(
    tenantId: string,
    pipelineId: string,
    orderedIds: string[],
  ) {
    await this.getOrThrow(tenantId, pipelineId);
    const statuses = await this.prisma.pipelineStatus.findMany({
      where: { pipelineId, id: { in: orderedIds } },
      select: { id: true },
    });
    if (statuses.length !== orderedIds.length) {
      throw new ForbiddenException('Недопустимый список статусов');
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.pipelineStatus.update({
          where: { id, pipelineId },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.list(tenantId);
  }

  async deleteStatus(tenantId: string, statusId: string) {
    const status = await this.getStatusOrThrow(tenantId, statusId);
    const activeCount = await this.prisma.lead.count({
      where: { statusId, archived: false },
    });
    if (activeCount > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: `Нельзя удалить статус: ${activeCount} активных лидов`,
        leadCount: activeCount,
      });
    }
    await this.prisma.pipelineStatus.delete({ where: { id: status.id } });
    return { success: true };
  }

  async getDefaultStatus(tenantId: string) {
    const pipeline = await this.ensureDefaultPipeline(tenantId);
    return pipeline.statuses[0] ?? null;
  }

  private async getOrThrow(tenantId: string, id: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id, tenantId },
    });
    if (!pipeline) throw new NotFoundException('Воронка не найдена');
    return pipeline;
  }

  private async getStatusOrThrow(tenantId: string, statusId: string) {
    const status = await this.prisma.pipelineStatus.findFirst({
      where: { id: statusId, pipeline: { tenantId } },
    });
    if (!status) throw new NotFoundException('Статус не найден');
    return status;
  }

  private toDto(pipeline: {
    id: string;
    tenantId: string;
    name: string;
    isDefault: boolean;
    createdAt: Date;
    statuses: Array<{
      id: string;
      pipelineId: string;
      name: string;
      sortOrder: number;
      color: string;
    }>;
  }) {
    return {
      id: pipeline.id,
      tenantId: pipeline.tenantId,
      name: pipeline.name,
      isDefault: pipeline.isDefault,
      createdAt: pipeline.createdAt.toISOString(),
      statuses: pipeline.statuses.map((s) => this.statusToDto(s)),
    };
  }

  private statusToDto(status: {
    id: string;
    pipelineId: string;
    name: string;
    sortOrder: number;
    color: string;
  }) {
    return {
      id: status.id,
      pipelineId: status.pipelineId,
      name: status.name,
      sortOrder: status.sortOrder,
      color: status.color,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AnalyticsDashboardDto,
  AnalyticsReportScheduleDto,
  AnalyticsWidgetConfig,
  SaveAnalyticsDashboardDto,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AnalyticsDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmin(): Promise<AnalyticsDashboardDto[]> {
    const rows = await this.prisma.analyticsDashboard.findMany({
      where: { scope: 'admin' },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async listTenant(tenantId: string): Promise<AnalyticsDashboardDto[]> {
    const rows = await this.prisma.analyticsDashboard.findMany({
      where: { scope: 'tenant', tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async createAdmin(dto: SaveAnalyticsDashboardDto) {
    const row = await this.prisma.analyticsDashboard.create({
      data: {
        scope: 'admin',
        name: dto.name,
        widgetsJson: dto.widgets as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toDto(row);
  }

  async updateAdmin(id: string, dto: SaveAnalyticsDashboardDto) {
    const row = await this.prisma.analyticsDashboard.update({
      where: { id, scope: 'admin' },
      data: {
        name: dto.name,
        widgetsJson: dto.widgets as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toDto(row);
  }

  async createSchedule(input: {
    dashboardId: string;
    recipientEmail: string;
    cronHour: number;
    cronMinute: number;
  }): Promise<AnalyticsReportScheduleDto> {
    const row = await this.prisma.analyticsReportSchedule.create({
      data: input,
    });
    return this.toScheduleDto(row);
  }

  async listSchedules(dashboardId: string) {
    const rows = await this.prisma.analyticsReportSchedule.findMany({
      where: { dashboardId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toScheduleDto(row));
  }

  async getDashboard(id: string) {
    const row = await this.prisma.analyticsDashboard.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Дашборд не найден');
    return this.toDto(row);
  }

  private toDto(row: {
    id: string;
    scope: 'admin' | 'tenant';
    tenantId: string | null;
    name: string;
    widgetsJson: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): AnalyticsDashboardDto {
    return {
      id: row.id,
      scope: row.scope,
      tenantId: row.tenantId,
      name: row.name,
      widgets: (row.widgetsJson as AnalyticsWidgetConfig[]) ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toScheduleDto(row: {
    id: string;
    dashboardId: string;
    recipientEmail: string;
    cronHour: number;
    cronMinute: number;
    enabled: boolean;
    lastSentAt: Date | null;
  }): AnalyticsReportScheduleDto {
    return {
      id: row.id,
      dashboardId: row.dashboardId,
      recipientEmail: row.recipientEmail,
      cronHour: row.cronHour,
      cronMinute: row.cronMinute,
      enabled: row.enabled,
      lastSentAt: row.lastSentAt?.toISOString() ?? null,
    };
  }
}

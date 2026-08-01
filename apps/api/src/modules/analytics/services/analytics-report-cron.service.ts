import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailService } from '../../../common/email/email.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnalyticsDashboardService } from './analytics-dashboard.service';
import { AnalyticsExportService } from './analytics-export.service';
import { ReportBuilderService } from './report-builder.service';
import type { AnalyticsWidgetConfig } from '@ai-consultant/shared-types';

@Injectable()
export class AnalyticsReportCronService {
  private readonly logger = new Logger(AnalyticsReportCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboards: AnalyticsDashboardService,
    private readonly reportBuilder: ReportBuilderService,
    private readonly exportService: AnalyticsExportService,
    private readonly email: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchScheduledReports() {
    const now = new Date();
    const schedules = await this.prisma.analyticsReportSchedule.findMany({
      where: { enabled: true },
      include: { dashboard: true },
    });

    for (const schedule of schedules) {
      if (
        schedule.cronHour !== now.getHours() ||
        schedule.cronMinute !== now.getMinutes()
      ) {
        continue;
      }

      if (
        schedule.lastSentAt &&
        schedule.lastSentAt.toDateString() === now.toDateString() &&
        schedule.lastSentAt.getHours() === now.getHours() &&
        schedule.lastSentAt.getMinutes() === now.getMinutes()
      ) {
        continue;
      }

      await this.sendReport(schedule.dashboardId, schedule.recipientEmail);
      await this.prisma.analyticsReportSchedule.update({
        where: { id: schedule.id },
        data: { lastSentAt: now },
      });
      this.logger.log(
        `Scheduled analytics report sent to ${schedule.recipientEmail}`,
      );
    }
  }

  private async sendReport(dashboardId: string, recipientEmail: string) {
    const dashboard = await this.dashboards.getDashboard(dashboardId);
    const widgets = dashboard.widgets as AnalyticsWidgetConfig[];
    const from = new Date(nowMinusDays(30)).toISOString();
    const to = new Date().toISOString();

    const sections = [];
    for (const widget of widgets.slice(0, 10)) {
      const data = await this.reportBuilder.query({
        metric: widget.metric,
        dimension: widget.dimension,
        from,
        to,
        tenantId: dashboard.tenantId ?? undefined,
      });
      sections.push(this.exportService.toCsv(data, 'query'));
    }

    const html = this.exportService.toHtmlReport(
      {
        metric: widgets[0]?.metric ?? 'mrr',
        from,
        to,
        series: [],
        total: 0,
        cached: false,
      },
      dashboard.name,
    );

    await this.email.sendAnalyticsReport(
      recipientEmail,
      dashboard.name,
      sections.join('\n\n'),
      html,
    );
  }
}

function nowMinusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportLeadsCsv(tenantId: string): Promise<string> {
    const leads = await this.prisma.lead.findMany({
      where: { tenantId, archived: false },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const header = 'id,name,phone,email,created_at';
    const rows = leads.map((lead) =>
      [
        lead.id,
        csvEscape(lead.name ?? ''),
        csvEscape(lead.phone ?? ''),
        csvEscape(lead.email ?? ''),
        lead.createdAt.toISOString(),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  async exportTenantJson(tenantId: string) {
    const [leads, dialogs, messages] = await Promise.all([
      this.prisma.lead.findMany({
        where: { tenantId },
        take: 5000,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dialog.findMany({
        where: { tenantId },
        take: 5000,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.findMany({
        where: { tenantId },
        take: 20000,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      leads: leads.map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        createdAt: l.createdAt.toISOString(),
      })),
      dialogs: dialogs.map((d) => ({
        id: d.id,
        sourceId: d.sourceId,
        visitorId: d.visitorId,
        status: d.status,
        startedAt: d.startedAt.toISOString(),
        endedAt: d.endedAt?.toISOString() ?? null,
      })),
      messages: messages.map((m) => ({
        id: m.id,
        dialogId: m.dialogId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

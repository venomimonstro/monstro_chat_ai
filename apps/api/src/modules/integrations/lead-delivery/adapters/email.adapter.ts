import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../../../common/email/email.service';
import type { ILeadDeliveryAdapter, LeadDeliveryContext } from '../lead-delivery.types';
import {
  buildCrmLeadUrl,
  formatLeadFields,
} from '../lead-delivery.types';

@Injectable()
export class EmailDeliveryAdapter implements ILeadDeliveryAdapter {
  readonly type = 'email' as const;
  private readonly logger = new Logger(EmailDeliveryAdapter.name);

  constructor(private readonly email: EmailService) {}

  async deliver(ctx: LeadDeliveryContext): Promise<void> {
    const recipients = Array.isArray(ctx.config.recipients)
      ? (ctx.config.recipients as string[]).filter(Boolean)
      : [];
    if (!recipients.length) {
      throw new Error('Email: не указаны получатели');
    }

    const fields = formatLeadFields(ctx.lead);
    const crmUrl = buildCrmLeadUrl(ctx.webClientUrl, ctx.lead.id);
    const subject = ctx.test
      ? '[Тест] Новый лид — AI Consultant'
      : 'Новый лид — AI Consultant';

    const html = `
      <h2>${ctx.test ? 'Тестовый лид' : 'Новый лид'}</h2>
      <table>
        <tr><td><strong>Имя</strong></td><td>${fields.firstName || '—'}</td></tr>
        <tr><td><strong>Фамилия</strong></td><td>${fields.lastName || '—'}</td></tr>
        <tr><td><strong>Телефон</strong></td><td>${fields.phone || '—'}</td></tr>
        <tr><td><strong>Email</strong></td><td>${fields.email || '—'}</td></tr>
        <tr><td><strong>Источник</strong></td><td>${fields.source}</td></tr>
        <tr><td><strong>UTM</strong></td><td>${fields.utm}</td></tr>
      </table>
      <p><a href="${crmUrl}">Открыть в CRM</a></p>
    `;

    await this.email.sendLeadDelivery(recipients, subject, html);
    this.logger.log(`Email delivery sent for lead ${ctx.lead.id}`);
  }
}

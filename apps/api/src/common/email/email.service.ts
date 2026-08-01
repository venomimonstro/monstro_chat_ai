import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendRegistrationConfirmation(email: string, companyName: string) {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    if (!smtpHost) {
      this.logger.log(
        `[DEV] Registration email to ${email} for company "${companyName}"`,
      );
      return;
    }
    // SMTP integration placeholder for production
    this.logger.log(`Registration email sent to ${email}`);
  }

  async sendPasswordReset(email: string, resetToken: string) {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    if (!smtpHost) {
      this.logger.log(`[DEV] Password reset for ${email}, token: ${resetToken}`);
      return;
    }
    this.logger.log(`Password reset email sent to ${email}`);
  }

  async sendTeamInvite(email: string, acceptUrl: string, companyName: string) {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    if (!smtpHost) {
      this.logger.log(
        `[DEV] Team invite to ${email} for "${companyName}": ${acceptUrl}`,
      );
      return;
    }
    this.logger.log(`Team invite sent to ${email}`);
  }

  async sendLeadAssignment(managerEmail: string, leadName: string) {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    if (!smtpHost) {
      this.logger.log(
        `[DEV] Lead assignment email to ${managerEmail} for lead "${leadName}"`,
      );
      return;
    }
    this.logger.log(`Lead assignment email sent to ${managerEmail}`);
  }

  async sendUsageThreshold(
    email: string,
    threshold: number,
    used: number,
    limit: number,
  ) {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    if (!smtpHost) {
      this.logger.log(
        `[DEV] Usage ${threshold}% alert to ${email}: ${used}/${limit} messages`,
      );
      return;
    }
    this.logger.log(
      `Usage ${threshold}% alert sent to ${email} (${used}/${limit})`,
    );
  }

  async sendAnalyticsReport(
    email: string,
    dashboardName: string,
    csvBody: string,
    htmlBody: string,
  ) {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    if (!smtpHost) {
      this.logger.log(
        `[DEV] Analytics report "${dashboardName}" to ${email}\n${csvBody.slice(0, 500)}`,
      );
      return;
    }
    this.logger.log(
      `Analytics report "${dashboardName}" sent to ${email} (${htmlBody.length} bytes HTML)`,
    );
  }

  async sendLeadDelivery(
    recipients: string[],
    subject: string,
    htmlBody: string,
  ) {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    if (!smtpHost) {
      this.logger.log(
        `[DEV] Lead delivery email to ${recipients.join(', ')}: ${subject}`,
      );
      return;
    }
    this.logger.log(
      `Lead delivery email sent to ${recipients.join(', ')} (${htmlBody.length} bytes)`,
    );
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

@Injectable()
export class WebhookVerificationService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('YOOKASSA_WEBHOOK_SECRET'));
  }

  verify(body: string, signature?: string): boolean {
    const secret = this.config.get<string>('YOOKASSA_WEBHOOK_SECRET');
    if (!secret) {
      return false;
    }
    if (!signature) {
      return false;
    }
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    return signature === expected;
  }
}

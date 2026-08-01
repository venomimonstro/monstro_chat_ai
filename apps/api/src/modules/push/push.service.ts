import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { PushSubscriptionDto } from '@ai-consultant/shared-types';

type WebPushModule = typeof import('web-push');

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private webPush: WebPushModule | null = null;
  private readonly publicKey: string;
  private readonly privateKey: string;
  private readonly subject: string;
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.publicKey = config.get('VAPID_PUBLIC_KEY', '');
    this.privateKey = config.get('VAPID_PRIVATE_KEY', '');
    this.subject = config.get('VAPID_SUBJECT', 'mailto:support@example.com');
    this.enabled = Boolean(this.publicKey && this.privateKey);
    if (!this.enabled) {
      this.logger.warn('VAPID keys not set — web push disabled');
    }
  }

  private async getWebPush(): Promise<WebPushModule | null> {
    if (!this.enabled) return null;
    if (!this.webPush) {
      this.webPush = await import('web-push');
      this.webPush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
    }
    return this.webPush;
  }

  getPublicKey() {
    return { publicKey: this.publicKey };
  }

  async subscribe(userId: string, tenantId: string, dto: PushSubscriptionDto) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        tenantId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
      update: {
        userId,
        tenantId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });
    return { success: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { success: true };
  }

  async notifyTenant(
    tenantId: string,
    payload: { title: string; body: string; url?: string },
  ) {
    const webPush = await this.getWebPush();
    if (!webPush) return;

    const subs = await this.prisma.pushSubscription.findMany({
      where: { tenantId },
    });

    const body = JSON.stringify(payload);
    for (const sub of subs) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
      } catch (error) {
        this.logger.warn(`Push failed for ${sub.endpoint}: ${String(error)}`);
        await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
      }
    }
  }
}

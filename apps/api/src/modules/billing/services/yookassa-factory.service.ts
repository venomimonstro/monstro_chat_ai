import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { YooKassa } from '@webzaytsev/yookassa-ts-sdk';

type YooKassaClient = ReturnType<typeof YooKassa>;

@Injectable()
export class YooKassaFactoryService {
  constructor(private readonly config: ConfigService) {}

  getClient(): YooKassaClient | null {
    const shopId = this.config.get<string>('YOOKASSA_SHOP_ID');
    const secretKey = this.config.get<string>('YOOKASSA_SECRET_KEY');

    if (!shopId || !secretKey) {
      return null;
    }

    return YooKassa({
      shop_id: shopId,
      secret_key: secretKey,
    }) as YooKassaClient;
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('YOOKASSA_SHOP_ID') &&
        this.config.get<string>('YOOKASSA_SECRET_KEY'),
    );
  }
}

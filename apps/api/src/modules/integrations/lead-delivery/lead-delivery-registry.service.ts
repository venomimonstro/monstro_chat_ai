import { Injectable } from '@nestjs/common';
import { LeadDeliveryChannelType } from '@prisma/client';
import type { ILeadDeliveryAdapter } from './lead-delivery.types';
import { TelegramDeliveryAdapter } from './adapters/telegram.adapter';
import { EmailDeliveryAdapter } from './adapters/email.adapter';
import { GoogleSheetsDeliveryAdapter } from './adapters/google-sheets.adapter';
import { AmocrmDeliveryAdapter } from './adapters/amocrm-delivery.adapter';
import { Bitrix24DeliveryAdapter } from './adapters/bitrix24-delivery.adapter';

@Injectable()
export class LeadDeliveryRegistryService {
  private readonly adapters: Map<LeadDeliveryChannelType, ILeadDeliveryAdapter>;

  constructor(
    telegram: TelegramDeliveryAdapter,
    email: EmailDeliveryAdapter,
    googleSheets: GoogleSheetsDeliveryAdapter,
    amocrm: AmocrmDeliveryAdapter,
    bitrix24: Bitrix24DeliveryAdapter,
  ) {
    this.adapters = new Map<LeadDeliveryChannelType, ILeadDeliveryAdapter>([
      [LeadDeliveryChannelType.telegram, telegram],
      [LeadDeliveryChannelType.email, email],
      [LeadDeliveryChannelType.google_sheets, googleSheets],
      [LeadDeliveryChannelType.amocrm, amocrm],
      [LeadDeliveryChannelType.bitrix24, bitrix24],
    ]);
  }

  get(type: LeadDeliveryChannelType): ILeadDeliveryAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new Error(`Адаптер доставки не найден: ${type}`);
    }
    return adapter;
  }
}

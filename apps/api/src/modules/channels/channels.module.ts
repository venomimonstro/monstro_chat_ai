import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsSetupService } from './channels-setup.service';
import { ChannelMessageService } from './channel-message.service';
import {
  ChannelRegistryService,
  TelegramChannelAdapter,
  VkChannelAdapter,
} from './channel-adapters';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SourcesModule } from '../sources/sources.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [IntegrationsModule, SourcesModule, AiModule],
  controllers: [ChannelsController],
  providers: [
    ChannelsSetupService,
    ChannelMessageService,
    ChannelRegistryService,
    TelegramChannelAdapter,
    VkChannelAdapter,
  ],
  exports: [ChannelsSetupService],
})
export class ChannelsModule {}

import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller';
import { ChatGateway } from './chat.gateway';
import { SourcesModule } from '../sources/sources.module';
import { AiModule } from '../ai/ai.module';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [SourcesModule, AiModule, CrmModule],
  controllers: [WidgetController],
  providers: [ChatGateway],
})
export class WidgetModule {}

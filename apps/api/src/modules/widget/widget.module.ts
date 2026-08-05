import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller';
import { ChatGateway } from './chat.gateway';
import { SourcesModule } from '../sources/sources.module';
import { AiModule } from '../ai/ai.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [SourcesModule, AiModule, AnalyticsModule],
  controllers: [WidgetController],
  providers: [ChatGateway],
})
export class WidgetModule {}

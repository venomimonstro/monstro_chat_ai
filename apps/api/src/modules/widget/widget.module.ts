import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WidgetController } from './widget.controller';
import { ChatGateway } from './chat.gateway';
import { WidgetSessionService } from './services/widget-session.service';
import { SourcesModule } from '../sources/sources.module';
import { AiModule } from '../ai/ai.module';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [
    SourcesModule,
    AiModule,
    CrmModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [WidgetController],
  providers: [ChatGateway, WidgetSessionService],
  exports: [WidgetSessionService],
})
export class WidgetModule {}

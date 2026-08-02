import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { EmailModule } from './common/email/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { BillingModule } from './modules/billing/billing.module';
import { AiModule } from './modules/ai/ai.module';
import { CrmModule } from './modules/crm/crm.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { SourcesModule } from './modules/sources/sources.module';
import { WidgetModule } from './modules/widget/widget.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { PromptsModule } from './modules/prompts/prompts.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PublicModule } from './modules/public/public.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TeamModule } from './modules/team/team.module';
import { ExportModule } from './modules/export/export.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { PushModule } from './modules/push/push.module';
import { RbacModule } from './common/rbac/rbac.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { TwoFaRequiredGuard } from './modules/auth/guards/two-fa-required.guard';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    RbacModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    EmailModule,
    HealthModule,
    AuthModule,
    TenantModule,
    BillingModule,
    AiModule,
    CrmModule,
    IntegrationsModule,
    SourcesModule,
    WidgetModule,
    KnowledgeModule,
    PromptsModule,
    AdminModule,
    AnalyticsModule,
    PublicModule,
    NotificationsModule,
    TeamModule,
    ExportModule,
    ChannelsModule,
    PushModule,
  ],
  providers: [
    CsrfMiddleware,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TwoFaRequiredGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}

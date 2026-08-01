import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async setTenantContext(tenantId: string | null) {
    if (tenantId) {
      await this.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, false)`;
    } else {
      await this.$executeRawUnsafe(`RESET app.current_tenant_id`);
    }
  }

  async resetTenantContext() {
    await this.$executeRawUnsafe(`RESET app.current_tenant_id`);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Тенант не найден');
    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
      createdAt: tenant.createdAt,
    };
  }

  async update(id: string, data: { name: string }) {
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { name: data.name },
    });
    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async hasPermission(role: UserRole, permission: string): Promise<boolean> {
    const count = await this.prisma.rolePermission.count({
      where: {
        role,
        permission: { code: permission },
      },
    });
    return count > 0;
  }

  async getPermissionsForRole(role: UserRole): Promise<string[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role },
      include: { permission: true },
    });
    return rows.map((r) => r.permission.code);
  }
}

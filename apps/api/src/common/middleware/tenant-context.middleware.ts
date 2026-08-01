import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as Request & { authUser?: AuthenticatedUser }).authUser;

    try {
      if (user?.tenantId) {
        await this.prisma.setTenantContext(user.tenantId);
        (req as Request & { tenantId?: string }).tenantId = user.tenantId;
      }

      const bodyTenantId =
        req.body?.tenantId ?? req.body?.tenant_id ?? req.params?.tenantId;

      if (bodyTenantId && user?.tenantId && bodyTenantId !== user.tenantId) {
        throw new ForbiddenException('Доступ к данным другого тенанта запрещён');
      }

      next();
    } finally {
      await this.prisma.resetTenantContext();
    }
  }
}

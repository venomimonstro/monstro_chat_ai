import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<
      Request & { authUser?: AuthenticatedUser; tenantId?: string }
    >();
    const user = req.authUser;

    return from(this.applyContext(req, user)).pipe(
      switchMap(() =>
        next.handle().pipe(
          finalize(() => {
            void this.prisma.resetTenantContext();
          }),
        ),
      ),
    );
  }

  private async applyContext(
    req: Request & { tenantId?: string },
    user?: AuthenticatedUser,
  ): Promise<void> {
    if (user?.tenantId) {
      await this.prisma.setTenantContext(user.tenantId);
      req.tenantId = user.tenantId;
    }

    const bodyTenantId =
      req.body?.tenantId ??
      req.body?.tenant_id ??
      req.params?.tenantId ??
      (typeof req.query?.tenantId === 'string' ? req.query.tenantId : undefined);

    if (bodyTenantId && user?.tenantId && bodyTenantId !== user.tenantId) {
      throw new ForbiddenException('Доступ к данным другого тенанта запрещён');
    }
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const correlationId =
      (request.headers['x-correlation-id'] as string) ??
      (request.cookies?.correlation_id as string) ??
      crypto.randomUUID();

    request.headers['x-correlation-id'] = correlationId;

    const start = performance.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Math.round(performance.now() - start);
          this.logger.log({
            correlationId,
            method: request.method,
            path: request.path,
            status: 200,
            durationMs: duration,
            userAgent: request.headers['user-agent'],
          });
        },
        error: (error) => {
          const duration = Math.round(performance.now() - start);
          this.logger.error({
            correlationId,
            method: request.method,
            path: request.path,
            status: error.status ?? 500,
            durationMs: duration,
            message: error.message,
            code: error.code,
          });
        },
      }),
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { Server, Socket } from 'socket.io';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import type { CanaryMetricsDto, DeployLogEntry } from '@ai-consultant/shared-types';

@WebSocketGateway({
  namespace: '/admin/deploy',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class UpdatesGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(UpdatesGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined);
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify<{ sub: string; role?: string }>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      if (!payload.role || !['owner', 'admin'].includes(payload.role)) {
        client.disconnect();
        return;
      }
      client.data.userId = payload.sub;
      client.emit('connected', { ok: true });

      this.startRevalidation(client, payload.sub);
    } catch (error) {
      this.logger.warn(`Deploy WS auth failed: ${String(error)}`);
      client.disconnect();
    }
  }

  private startRevalidation(client: Socket, userId: string) {
    const interval = setInterval(async () => {
      if (!client.connected) {
        clearInterval(interval);
        return;
      }
      try {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.status !== 'active' || !['owner', 'admin'].includes(user.role)) {
          client.disconnect(true);
          clearInterval(interval);
        }
      } catch {
        client.disconnect(true);
        clearInterval(interval);
      }
    }, 60_000);
  }

  joinUpdate(client: Socket, updateId: string) {
    client.join(`update:${updateId}`);
  }

  emitLog(updateId: string, entry: DeployLogEntry) {
    this.server.to(`update:${updateId}`).emit('deploy:log', entry);
  }

  emitStatus(updateId: string, status: string) {
    this.server.to(`update:${updateId}`).emit('deploy:status', { status });
  }

  emitCanary(updateId: string, metrics: CanaryMetricsDto) {
    this.server.to(`update:${updateId}`).emit('canary:metrics', metrics);
  }
}

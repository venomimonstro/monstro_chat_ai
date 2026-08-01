import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface IndexingProgressPayload {
  tenantId: string;
  jobId: string;
  processed: number;
  total: number;
  status?: string;
}

@WebSocketGateway({
  namespace: '/indexing',
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, ok?: boolean) => void) => {
      callback(null, true);
    },
    credentials: true,
  },
})
export class IndexingGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(IndexingGateway.name);

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

      const payload = this.jwtService.verify<{ sub: string; tenantId?: string }>(
        token,
        { secret: this.config.get<string>('JWT_SECRET') },
      );

      if (!payload.tenantId) {
        client.disconnect();
        return;
      }

      client.data.tenantId = payload.tenantId;
      client.data.userId = payload.sub;
      client.join(`tenant:${payload.tenantId}`);
      client.emit('connected', { ok: true });

      this.startRevalidation(client, payload.sub, payload.tenantId);
    } catch (error) {
      this.logger.warn(`WS auth failed: ${String(error)}`);
      client.disconnect();
    }
  }

  private startRevalidation(client: Socket, userId: string, tenantId: string) {
    const interval = setInterval(async () => {
      if (!client.connected) {
        clearInterval(interval);
        return;
      }
      try {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.status !== 'active' || user.tenantId !== tenantId) {
          client.disconnect(true);
          clearInterval(interval);
        }
      } catch {
        client.disconnect(true);
        clearInterval(interval);
      }
    }, 60_000);
  }

  emitProgress(payload: IndexingProgressPayload) {
    this.server
      .to(`tenant:${payload.tenantId}`)
      .emit('indexing:progress', payload);
  }
}

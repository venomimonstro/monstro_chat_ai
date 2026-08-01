import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/crm',
  cors: { origin: true, credentials: true },
})
export class CrmGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CrmGateway.name);

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

      const payload = this.jwtService.verify<{
        sub: string;
        tenantId?: string;
      }>(token, { secret: this.config.get<string>('JWT_SECRET') });

      if (!payload.tenantId) {
        client.disconnect();
        return;
      }

      client.data.userId = payload.sub;
      client.data.tenantId = payload.tenantId;
      client.join(`tenant:${payload.tenantId}`);
      client.join(`user:${payload.sub}`);
      client.emit('connected', { ok: true });

      this.startRevalidation(client, payload.sub, payload.tenantId);
    } catch (error) {
      this.logger.warn(`CRM WS auth failed: ${String(error)}`);
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

  emitLeadAssigned(
    tenantId: string,
    userId: string,
    payload: {
      leadId: string;
      name: string | null;
      phone: string | null;
      assignedBy?: string;
    },
  ) {
    this.server.to(`user:${userId}`).emit('lead:assigned', {
      tenantId,
      ...payload,
    });
  }

  emitNewLead(
    tenantId: string,
    payload: {
      leadId: string;
      name: string | null;
      phone: string | null;
    },
  ) {
    this.server.to(`tenant:${tenantId}`).emit('lead:created', {
      tenantId,
      ...payload,
    });
  }

  emitNotification(
    tenantId: string,
    notification: {
      id: string;
      type: string;
      title: string;
      body: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    },
  ) {
    this.server.to(`tenant:${tenantId}`).emit('notification:new', notification);
  }
}

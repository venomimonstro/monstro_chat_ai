import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { FollowUpPushPayload } from './follow-up.types';

@Injectable()
export class FollowUpPushService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  push(payload: FollowUpPushPayload): boolean {
    if (!this.server) return false;
    this.server.to(`visitor:${payload.visitorId}`).emit('follow_up:message', {
      dialogId: payload.dialogId,
      messageId: payload.messageId,
      content: payload.content,
      createdAt: payload.createdAt,
    });
    return true;
  }
}

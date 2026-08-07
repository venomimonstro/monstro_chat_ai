import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import type { TeamInviteDto, TeamMemberDto } from '@ai-consultant/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { ConfigService } from '@nestjs/config';
import { InviteUserDto } from './dto/team.dto';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async listMembers(tenantId: string): Promise<TeamMemberDto[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId, status: 'active' },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async listInvites(tenantId: string): Promise<TeamInviteDto[]> {
    const rows = await this.prisma.userInvite.findMany({
      where: { tenantId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expiresAt.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async invite(
    tenantId: string,
    actor: AuthenticatedUser,
    dto: InviteUserDto,
  ) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    const pending = await this.prisma.userInvite.findFirst({
      where: {
        tenantId,
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (pending) {
      throw new ConflictException('Приглашение уже отправлено');
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.userInvite.create({
      data: {
        tenantId,
        email,
        role: dto.role ?? 'manager',
        tokenHash,
        invitedById: actor.id,
        expiresAt,
      },
    });

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const webClientUrl = this.config.get('WEB_CLIENT_URL', 'http://localhost:5173');
    const acceptUrl = `${webClientUrl}/accept-invite?token=${token}`;
    await this.email.sendTeamInvite(email, acceptUrl, tenant?.name ?? '');

    return { success: true };
  }

  async revokeInvite(tenantId: string, inviteId: string) {
    const result = await this.prisma.userInvite.deleteMany({
      where: { id: inviteId, tenantId, acceptedAt: null },
    });
    if (result.count === 0) {
      throw new NotFoundException('Приглашение не найдено');
    }
    return { success: true };
  }

  async revokeMember(tenantId: string, userId: string, actorId: string) {
    if (userId === actorId) {
      throw new BadRequestException('Нельзя отозвать доступ у себя');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    if (user.role === 'client') {
      throw new BadRequestException('Нельзя отозвать доступ владельца');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'revoked', sessionVersion: { increment: 1 } },
    });
    return { success: true };
  }

  async acceptInvite(token: string, password: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invite = await this.prisma.userInvite.findFirst({
      where: { tokenHash, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!invite) {
      throw new BadRequestException('Приглашение недействительно или истекло');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existing) {
      throw new ConflictException('Пользователь уже зарегистрирован');
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invite.email,
          passwordHash,
          role: invite.role,
          tenantId: invite.tenantId,
        },
      });
      await tx.userInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      return created;
    });

    return {
      success: true,
      email: user.email,
    };
  }
}

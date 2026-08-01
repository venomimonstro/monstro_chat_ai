import type { UserRole } from './index';

export interface TeamMemberDto {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  createdAt: string;
}

export interface TeamInviteDto {
  id: string;
  email: string;
  role: UserRole;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface InviteUserDto {
  email: string;
  role?: 'manager';
}

export interface AcceptInviteDto {
  token: string;
  password: string;
}

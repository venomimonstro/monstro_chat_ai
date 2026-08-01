import { UserRole } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  type: 'access' | 'two_fa';
  twoFaVerified?: boolean;
  impersonatedBy?: string;
  impersonationActorEmail?: string;
  impersonationReason?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  twoFaVerified: boolean;
  impersonatedBy?: string;
  impersonationActorEmail?: string;
  impersonationReason?: string;
}

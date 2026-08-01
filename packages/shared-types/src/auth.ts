export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string | null;
  impersonation?: ImpersonationInfo | null;
}

export interface ImpersonationInfo {
  actorUserId: string;
  actorEmail: string;
  reason?: string;
}

export interface AuthResponse {
  accessToken?: string;
  user: AuthUser;
  requires2fa?: boolean;
  requires2faSetup?: boolean;
  twoFaToken?: string;
}

export interface RegisterRequest {
  companyName: string;
  email: string;
  password: string;
  pdConsent: boolean;
  tariffId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface Verify2faRequest {
  code: string;
  twoFaToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

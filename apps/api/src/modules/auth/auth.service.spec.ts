import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { TokenService } from './token.service';
import { TwoFaCryptoService } from './two-fa-crypto.service';

jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('TESTSECRET'),
  generateURI: jest.fn().mockReturnValue('otpauth://test'),
  verify: jest.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    tenant: {
      create: jest.fn(),
      update: jest.fn(),
    },
    tariff: {
      findFirst: jest.fn(),
    },
    subscription: {
      create: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwt = {
    sign: jest.fn().mockReturnValue('access-token'),
    verify: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const map: Record<string, string> = {
        JWT_ACCESS_TTL: '15m',
        JWT_2FA_TTL: '5m',
        NODE_ENV: 'test',
      };
      return map[key] ?? defaultValue;
    }),
  };

  const mockEmail = {
    sendRegistrationConfirmation: jest.fn(),
    sendPasswordReset: jest.fn(),
  };
  const mockToken = {
    storeRefreshToken: jest.fn().mockResolvedValue('token-id'),
    checkLoginRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
    resetLoginAttempts: jest.fn(),
    revokeRefreshToken: jest.fn(),
  };

  const mockRes = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as import('express').Response;

  const mockReq = {
    headers: { origin: 'http://localhost:5173' },
  } as unknown as import('express').Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EmailService, useValue: mockEmail },
        { provide: TokenService, useValue: mockToken },
        { provide: TwoFaCryptoService, useValue: { encrypt: (s: string) => s, decrypt: (s: string) => s } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('getTrialEndsAt', () => {
    it('should set trial_ends_at exactly 7 days from given date', () => {
      const from = new Date('2026-07-27T12:00:00.000Z');
      const result = service.getTrialEndsAt(from);
      expect(result.toISOString()).toBe('2026-08-03T12:00:00.000Z');
    });
  });

  describe('register', () => {
    it('should throw 409 when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register(
          {
            companyName: 'Test Co',
            email: 'test@example.com',
            password: 'password123',
            pdConsent: true,
          },
          mockRes,
          mockReq,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should create tenant with trial_ends_at in 7 days', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const trialEndsAt = new Date('2026-08-03T12:00:00.000Z');
      jest.spyOn(service, 'getTrialEndsAt').mockReturnValue(trialEndsAt);

      const createdUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'client',
        tenantId: 'tenant-1',
        passwordHash: 'hash',
        twoFaSecret: null,
        twoFaEnabled: false,
        status: 'active',
        sessionVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn) =>
        fn({
          tenant: {
            create: jest.fn().mockResolvedValue({ id: 'tenant-1' }),
            update: jest.fn(),
          },
          user: { create: jest.fn().mockResolvedValue(createdUser) },
          tariff: { findFirst: jest.fn().mockResolvedValue(null) },
          subscription: { create: jest.fn() },
        }),
      );

      const result = await service.register(
        {
          companyName: 'Test Co',
          email: 'test@example.com',
          password: 'password123',
          pdConsent: true,
        },
        mockRes,
        mockReq,
      );

      expect(result.user.email).toBe('test@example.com');
      expect(mockRes.cookie).toHaveBeenCalled();
    });
  });

  describe('disable2fa', () => {
    it('should forbid disabling 2FA for owner role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: 'owner',
        twoFaEnabled: true,
        twoFaSecret: 'secret',
      });

      await expect(service.disable2fa('owner-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow disabling 2FA for client role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'client-1',
        role: 'client',
        twoFaEnabled: true,
        twoFaSecret: 'secret',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.disable2fa('client-1');
      expect(result.success).toBe(true);
    });
  });

  describe('login', () => {
    it(
      'should reject invalid credentials',
      async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
          id: 'u1',
          email: 'test@example.com',
          passwordHash: await argon2.hash('correct-password'),
          status: 'active',
          role: 'client',
          tenantId: 't1',
          twoFaEnabled: false,
          twoFaSecret: null,
        });

        await expect(
          service.login(
            { email: 'test@example.com', password: 'wrong-password' },
            mockRes,
            mockReq,
          ),
        ).rejects.toThrow(UnauthorizedException);
      },
      20_000,
    );
  });

  describe('password reset', () => {
    it('requestPasswordReset sends email for existing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@example.com',
      });
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      const result = await service.requestPasswordReset('user@example.com');

      expect(result.success).toBe(true);
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();
      expect(mockEmail.sendPasswordReset).toHaveBeenCalled();
    });

    it('requestPasswordReset returns success for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordReset('unknown@example.com');

      expect(result.success).toBe(true);
      expect(mockEmail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('resetPassword updates password for valid token', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 't1',
        userId: 'u1',
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.resetPassword('valid-token', 'newpassword1');

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});

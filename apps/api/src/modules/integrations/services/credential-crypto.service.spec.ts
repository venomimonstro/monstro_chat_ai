import { ConfigService } from '@nestjs/config';
import { CredentialCryptoService } from './credential-crypto.service';

describe('CredentialCryptoService', () => {
  const config = {
    get: jest.fn((key: string) =>
      key === 'INTEGRATION_ENCRYPTION_KEY' ? 'test-secret-key' : undefined,
    ),
  } as unknown as ConfigService;

  let service: CredentialCryptoService;

  beforeEach(() => {
    service = new CredentialCryptoService(config);
  });

  it('encrypts and decrypts credentials', () => {
    const payload = JSON.stringify({ accessToken: 'abc', refreshToken: 'def' });
    const encrypted = service.encrypt(payload);
    expect(encrypted).not.toContain('abc');
    expect(service.decrypt(encrypted)).toBe(payload);
  });
});

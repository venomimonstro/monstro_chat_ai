import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

@Injectable()
export class TwoFaCryptoService {
  private readonly key: Buffer;
  private readonly logger = new Logger(TwoFaCryptoService.name);

  constructor(config: ConfigService) {
    const secret = config.get<string>('TWO_FA_SECRET_KEY');
    if (!secret) {
      if (config.get<string>('NODE_ENV') === 'production') {
        throw new Error('TWO_FA_SECRET_KEY must be set in production');
      }
      this.logger.warn(
        'TWO_FA_SECRET_KEY is not set; using JWT_SECRET fallback for development only',
      );
    }
    this.key = createHash('sha256')
      .update(secret ?? config.get<string>('JWT_SECRET', 'dev-2fa-secret'))
      .digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(payload: string): string | null {
    try {
      const [ivHex, tagHex, dataHex] = payload.split(':');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataHex, 'hex')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      return null;
    }
  }
}

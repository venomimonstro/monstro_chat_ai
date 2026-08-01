import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { TwoFaCryptoService } from './two-fa-crypto.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RbacModule } from '../../common/rbac/rbac.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' as const },
      }),
    }),
    RbacModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, TwoFaCryptoService, JwtStrategy],
  exports: [AuthService, TokenService, TwoFaCryptoService, JwtModule],
})
export class AuthModule {}

import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsBoolean,
  Equals,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  companyName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsBoolean()
  @Equals(true, {
    message: 'Необходимо согласие на обработку персональных данных',
  })
  pdConsent!: boolean;

  @IsOptional()
  @IsUUID()
  tariffId?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class TwoFaVerifyDto {
  @IsString()
  code!: string;

  @IsString()
  twoFaToken!: string;
}

export class TwoFaEnableDto {
  @IsString()
  code!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

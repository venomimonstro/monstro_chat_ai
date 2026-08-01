import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import type { UserRole } from '@prisma/client';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(['manager'])
  role?: UserRole;
}

export class AcceptInviteDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

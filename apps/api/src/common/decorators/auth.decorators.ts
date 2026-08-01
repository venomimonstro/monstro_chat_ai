import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const ALLOW_2FA_SETUP_KEY = 'allow2faSetup';
export const Allow2faSetup = () => SetMetadata(ALLOW_2FA_SETUP_KEY, true);

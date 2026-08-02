import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class SyncReleaseManifestDto {
  @IsString()
  @MinLength(1)
  version!: string;

  @IsInt()
  @Min(0)
  sprint!: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  gitSha?: string;

  @IsOptional()
  @IsString()
  previousVersion?: string;

  @IsOptional()
  @IsInt()
  previousSprint?: number;

  @IsOptional()
  @IsString()
  deployedAt?: string | null;
}

export class ReleaseReportDto {
  @IsString()
  updateId!: string;

  @IsString()
  phase!: string;

  @IsString()
  level!: 'info' | 'warn' | 'error';

  @IsString()
  message!: string;
}

export class ReleaseCompleteDto {
  @IsString()
  updateId!: string;

  @IsString()
  version!: string;

  @IsInt()
  sprint!: number;

  @IsBoolean()
  success!: boolean;
}

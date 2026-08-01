import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSystemUpdateDto {
  @IsString()
  @MinLength(1)
  version!: string;

  @IsOptional()
  @IsString()
  changelog?: string;

  @IsOptional()
  @IsString()
  gitSha?: string;

  @IsOptional()
  @IsString()
  imageTag?: string;
}

export class CreateBackupDto {
  @IsOptional()
  @IsString()
  label?: string;
}

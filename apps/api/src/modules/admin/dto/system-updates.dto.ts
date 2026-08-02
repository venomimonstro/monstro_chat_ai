import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateSystemUpdateDto {
  @IsString()
  @MinLength(1)
  version!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sprintNumber?: number;

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

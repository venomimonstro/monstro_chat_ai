import { IsOptional, IsString, IsUrl, IsUUID, MinLength } from 'class-validator';

export class StartCrawlDto {
  @IsUUID()
  sourceId!: string;

  @IsString()
  @IsUrl({ require_protocol: true })
  url!: string;
}

export class AddManualTextDto {
  @IsUUID()
  sourceId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(20)
  content!: string;
}

export class UpdateManualTextDto {
  @IsString()
  @MinLength(20)
  content!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;
}

export class ListDocumentsQueryDto {
  @IsUUID()
  sourceId!: string;
}

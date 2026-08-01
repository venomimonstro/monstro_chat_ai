import { IsString, IsUrl, IsUUID } from 'class-validator';

export class StartCrawlDto {
  @IsUUID()
  sourceId!: string;

  @IsString()
  @IsUrl({ require_protocol: true })
  url!: string;
}

export class ListDocumentsQueryDto {
  @IsUUID()
  sourceId!: string;
}

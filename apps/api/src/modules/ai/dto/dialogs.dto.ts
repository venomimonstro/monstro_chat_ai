import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListDialogsQueryDto {
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @IsIn(['active', 'closed'])
  status?: 'active' | 'closed';

  @IsOptional()
  @IsIn(['true', 'false'])
  hasLead?: 'true' | 'false';

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

import { IsString, IsOptional, IsArray, IsUUID, IsInt, Min } from 'class-validator';

export class CreatePipelineDto {
  @IsString()
  name!: string;
}

export class UpdatePipelineDto {
  @IsString()
  name!: string;
}

export class CreateStatusDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateStatusDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ReorderStatusesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds!: string[];
}

export class UpdateLeadStatusDto {
  @IsUUID()
  statusId!: string;
}

export class AssignLeadDto {
  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null;
}

export class UpdateLeadNotesDto {
  @IsString()
  notes!: string;
}

export class ArchiveLeadsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  leadIds!: string[];
}

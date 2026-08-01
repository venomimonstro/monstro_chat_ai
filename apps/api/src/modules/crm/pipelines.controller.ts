import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PipelinesService } from './services/pipelines.service';
import {
  CreatePipelineDto,
  UpdatePipelineDto,
  CreateStatusDto,
  UpdateStatusDto,
  ReorderStatusesDto,
} from './dto/crm.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PERMISSIONS } from '../../common/constants/permissions';

@Controller('pipelines')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.CRM_LEADS_VIEW)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.pipelinesService.list(user.tenantId!);
  }

  @Post()
  @RequirePermission(PERMISSIONS.CRM_LEADS_EDIT)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePipelineDto,
  ) {
    return this.pipelinesService.create(user.tenantId!, dto.name);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.CRM_LEADS_EDIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    return this.pipelinesService.update(user.tenantId!, id, dto.name);
  }

  @Post(':id/statuses')
  @RequirePermission(PERMISSIONS.CRM_LEADS_EDIT)
  createStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') pipelineId: string,
    @Body() dto: CreateStatusDto,
  ) {
    return this.pipelinesService.createStatus(
      user.tenantId!,
      pipelineId,
      dto,
    );
  }

  @Patch('statuses/:statusId')
  @RequirePermission(PERMISSIONS.CRM_LEADS_EDIT)
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('statusId') statusId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.pipelinesService.updateStatus(user.tenantId!, statusId, dto);
  }

  @Post(':id/statuses/reorder')
  @RequirePermission(PERMISSIONS.CRM_LEADS_EDIT)
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') pipelineId: string,
    @Body() dto: ReorderStatusesDto,
  ) {
    return this.pipelinesService.reorderStatuses(
      user.tenantId!,
      pipelineId,
      dto.orderedIds,
    );
  }

  @Delete('statuses/:statusId')
  @RequirePermission(PERMISSIONS.CRM_LEADS_EDIT)
  deleteStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('statusId') statusId: string,
  ) {
    return this.pipelinesService.deleteStatus(user.tenantId!, statusId);
  }
}

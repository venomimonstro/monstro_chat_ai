import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LeadsService } from './services/leads.service';
import {
  UpdateLeadStatusDto,
  AssignLeadDto,
  UpdateLeadNotesDto,
  ArchiveLeadsDto,
} from './dto/crm.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PERMISSIONS } from '../../common/constants/permissions';

@Controller('leads')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.CRM_LEADS_VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('statusId') statusId?: string,
    @Query('sourceId') sourceId?: string,
    @Query('assignedUserId') assignedUserId?: string,
    @Query('tag') tag?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.leadsService.findAll(user.tenantId!, {
      statusId,
      sourceId,
      assignedUserId,
      tag,
      from,
      to,
    });
  }

  @Get('users')
  @RequirePermission(PERMISSIONS.CRM_LEADS_VIEW)
  listUsers(@CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.listTenantUsers(user.tenantId!);
  }

  @Get('duplicates')
  @RequirePermission(PERMISSIONS.CRM_LEADS_VIEW)
  duplicates(
    @CurrentUser() user: AuthenticatedUser,
    @Query('phone') phone?: string,
    @Query('visitorId') visitorId?: string,
  ) {
    return this.leadsService.findDuplicates(user.tenantId!, {
      phone,
      visitorId,
    });
  }

  @Post('archive')
  @RequirePermission(PERMISSIONS.CRM_LEADS_EDIT)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ArchiveLeadsDto,
  ) {
    return this.leadsService.archiveMany(user.tenantId!, dto.leadIds);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.CRM_LEADS_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leadsService.findOne(user.tenantId!, id);
  }

  @Get(':id/history')
  @RequirePermission(PERMISSIONS.CRM_LEADS_VIEW)
  history(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leadsService.getStatusHistory(user.tenantId!, id);
  }

  @Get(':id/messages')
  @RequirePermission(PERMISSIONS.CRM_LEADS_VIEW)
  messages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leadsService.getDialogMessages(user.tenantId!, id);
  }

  @Patch(':id/status')
  @RequirePermission(PERMISSIONS.CRM_LEADS_EDIT)
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.leadsService.updateStatus(
      user.tenantId!,
      id,
      dto.statusId,
      user.id,
    );
  }

  @Patch(':id/assign')
  @RequirePermission(PERMISSIONS.CRM_LEADS_EDIT)
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
  ) {
    return this.leadsService.assign(
      user.tenantId!,
      id,
      dto.assignedUserId ?? null,
      user.id,
    );
  }

  @Patch(':id/notes')
  @RequirePermission(PERMISSIONS.CRM_LEADS_EDIT)
  updateNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadNotesDto,
  ) {
    return this.leadsService.updateNotes(user.tenantId!, id, dto.notes);
  }

  @Post(':id/merge/:targetId')
  @RequirePermission(PERMISSIONS.CRM_LEADS_EDIT)
  merge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sourceId: string,
    @Param('targetId') targetId: string,
  ) {
    return this.leadsService.merge(user.tenantId!, sourceId, targetId);
  }
}

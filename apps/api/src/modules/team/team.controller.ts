import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission, Public } from '../../common/decorators/auth.decorators';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { AcceptInviteDto, InviteUserDto } from './dto/team.dto';

@Controller('team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get('members')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  listMembers(@CurrentUser() user: AuthenticatedUser) {
    return this.team.listMembers(user.tenantId!);
  }

  @Get('invites')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  listInvites(@CurrentUser() user: AuthenticatedUser) {
    return this.team.listInvites(user.tenantId!);
  }

  @Post('invites')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  invite(@CurrentUser() user: AuthenticatedUser, @Body() dto: InviteUserDto) {
    return this.team.invite(user.tenantId!, user, dto);
  }

  @Delete('invites/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  revokeInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.team.revokeInvite(user.tenantId!, id);
  }

  @Delete('members/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  revokeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.team.revokeMember(user.tenantId!, id, user.id);
  }

  @Public()
  @Post('accept-invite')
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.team.acceptInvite(dto.token, dto.password);
  }
}

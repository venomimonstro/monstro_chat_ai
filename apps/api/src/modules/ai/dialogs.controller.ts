import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DialogsService } from './services/dialogs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PERMISSIONS } from '../../common/constants/permissions';

@Controller('dialogs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DialogsController {
  constructor(private readonly dialogs: DialogsService) {}

  private requireTenantId(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException(
        'Раздел чатов доступен только в аккаунте клиента. Войдите через «Войти как клиент» в админке.',
      );
    }
    return user.tenantId;
  }

  @Get()
  @RequirePermission(PERMISSIONS.CHATS_VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sourceId') sourceId?: string,
    @Query('status') status?: 'active' | 'closed',
    @Query('hasLead') hasLead?: 'true' | 'false',
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    if (parsedLimit !== undefined && Number.isNaN(parsedLimit)) {
      throw new BadRequestException('limit must be a number');
    }

    return this.dialogs.listDialogs(this.requireTenantId(user), {
      sourceId,
      status,
      hasLead: hasLead === undefined ? undefined : hasLead === 'true',
      q,
      cursor,
      limit: parsedLimit,
    });
  }

  @Get(':id/messages')
  @RequirePermission(PERMISSIONS.CHATS_VIEW)
  messages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.dialogs.getTranscript(this.requireTenantId(user), id);
  }

  @Get(':id/export')
  @RequirePermission(PERMISSIONS.CHATS_VIEW)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="dialog.txt"')
  async exportText(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.dialogs.exportTranscriptText(this.requireTenantId(user), id);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.CHATS_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.dialogs.getDialog(this.requireTenantId(user), id);
  }
}

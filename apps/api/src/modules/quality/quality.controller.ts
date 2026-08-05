import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BadAnswersService } from './services/bad-answers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PERMISSIONS } from '../../common/constants/permissions';

@Controller('quality')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QualityController {
  constructor(private readonly badAnswers: BadAnswersService) {}

  @Get('bad-answers')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  listBadAnswers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sourceId') sourceId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.badAnswers.listBadAnswers(user.tenantId!, {
      sourceId,
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sourceId') sourceId?: string,
  ) {
    return this.badAnswers.getStats(user.tenantId!, sourceId);
  }
}

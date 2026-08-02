import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Public, RequirePermission } from '../../common/decorators/auth.decorators';
import { PERMISSIONS } from '../../common/constants/permissions';
import { ReleaseService } from '../release/release.service';
import { SystemUpdatesService } from './services/system-updates.service';
import {
  ReleaseCompleteDto,
  ReleaseReportDto,
  SyncReleaseManifestDto,
} from './dto/release.dto';

@Controller('admin/release')
export class ReleaseController {
  constructor(
    private readonly release: ReleaseService,
    private readonly updates: SystemUpdatesService,
  ) {}

  @Get('current')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_VIEW)
  getCurrent() {
    return this.release.getCurrent();
  }

  @Get('sprints')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_VIEW)
  listSprints() {
    return this.release.listSprints();
  }

  @Get('updates/:id/instructions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.ADMIN_UPDATES_MANAGE)
  async deployInstructions(@Param('id') id: string) {
    const update = await this.updates.get(id);
    return this.updates.getDeployInstructions(update);
  }

  @Public()
  @Post('sync')
  syncManifest(
    @Headers('x-release-token') token: string,
    @Body() dto: SyncReleaseManifestDto,
  ) {
    this.release.validateDeployToken(token);
    return this.release.syncManifest(dto);
  }

  @Public()
  @Post('report')
  async report(
    @Headers('x-release-token') token: string,
    @Body() dto: ReleaseReportDto,
  ) {
    this.release.validateDeployToken(token);
    return this.updates.reportDeployLog(dto.updateId, dto.level, dto.message);
  }

  @Public()
  @Post('complete')
  async complete(
    @Headers('x-release-token') token: string,
    @Body() dto: ReleaseCompleteDto,
  ) {
    this.release.validateDeployToken(token);
    return this.updates.completeHostDeploy(
      dto.updateId,
      dto.success,
      dto.version,
      dto.sprint,
    );
  }
}

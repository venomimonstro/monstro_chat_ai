import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SourcesService } from './sources.service';
import { CreateSourceDto, UpdateSourceDto } from './dto/source.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PERMISSIONS } from '../../common/constants/permissions';

@Controller('sources')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.sourcesService.findAll(user.tenantId!);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sourcesService.findOne(user.tenantId!, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSourceDto) {
    return this.sourcesService.create(user.tenantId!, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSourceDto,
  ) {
    return this.sourcesService.update(user.tenantId!, id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sourcesService.remove(user.tenantId!, id);
  }

  @Post(':id/clone')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  clone(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sourcesService.clone(user.tenantId!, id);
  }
}

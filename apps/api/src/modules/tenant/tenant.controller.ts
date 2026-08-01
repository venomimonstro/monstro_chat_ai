import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PERMISSIONS } from '../../common/constants/permissions';
import { IsString, MinLength } from 'class-validator';

class UpdateTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  tenantId?: string;
}

@Controller('tenants')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('me')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantService.getById(user.tenantId!);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (dto.tenantId && dto.tenantId !== user.tenantId) {
      throw new ForbiddenException('Доступ к данным другого тенанта запрещён');
    }
    if (id !== user.tenantId) {
      throw new ForbiddenException('Доступ к данным другого тенанта запрещён');
    }
    return this.tenantService.update(id, { name: dto.name });
  }
}

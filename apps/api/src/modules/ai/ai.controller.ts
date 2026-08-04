import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { IsString, IsUUID, MinLength } from 'class-validator';
import { Public, RequirePermission } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AiService } from './ai.service';
import { RetrievalService } from './services/retrieval.service';
import { PrismaService } from '../../prisma/prisma.service';

class RetrievalTestDto {
  @IsUUID()
  sourceId!: string;

  @IsString()
  @MinLength(2)
  query!: string;
}

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly retrieval: RetrievalService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('status')
  getStatus() {
    return this.aiService.getStatus();
  }

  /** RAG diagnostics for LK Training tab. */
  @Post('retrieval-test')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  async retrievalTest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RetrievalTestDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('tenantId обязателен');
    }
    const source = await this.prisma.source.findFirst({
      where: { id: dto.sourceId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!source) {
      throw new BadRequestException('Источник не найден');
    }

    const result = await this.retrieval.search(
      user.tenantId,
      dto.sourceId,
      dto.query.trim(),
    );
    return this.retrieval.toDiagnostic(result);
  }
}

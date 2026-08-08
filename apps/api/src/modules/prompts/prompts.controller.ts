import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PromptScope } from '@prisma/client';
import { PromptsService } from './prompts.service';
import { PlaygroundService } from './playground.service';
import { PromptGenerationService } from './prompt-generation.service';
import { CreatePromptDto, CreateExperimentDto, PlaygroundTestDto, GeneratePromptFromUrlsDto } from './dto/prompt.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PERMISSIONS } from '../../common/constants/permissions';
import { PromptExperimentService } from './prompt-experiment.service';

@Controller('prompts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PromptsController {
  constructor(
    private readonly promptsService: PromptsService,
    private readonly playgroundService: PlaygroundService,
    private readonly promptGenerationService: PromptGenerationService,
    private readonly experiments: PromptExperimentService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope: PromptScope = 'tenant',
  ) {
    return this.promptsService.listHistory(user.tenantId!, scope);
  }

  @Get('active')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  getActive(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope: PromptScope = 'tenant',
  ) {
    return this.promptsService.getActive(user.tenantId!, scope);
  }

  @Get('limits')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  getLimits(@CurrentUser() user: AuthenticatedUser) {
    return this.promptsService.getPromptCharLimit(user.tenantId!);
  }

  @Post()
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePromptDto,
  ) {
    return this.promptsService.createVersion({
      tenantId: dto.scope === 'tenant' ? user.tenantId! : null,
      scope: dto.scope,
      content: dto.content,
      createdBy: user.id,
      userRole: user.role,
    });
  }

  @Post('playground/test')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  playgroundTest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PlaygroundTestDto,
  ) {
    return this.playgroundService.test({
      tenantId: user.tenantId!,
      sourceId: dto.sourceId,
      message: dto.message,
      clientPrompt: dto.clientPrompt,
      history: dto.history,
    });
  }

  @Post('generate-from-urls')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  generateFromUrls(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GeneratePromptFromUrlsDto,
  ) {
    return this.promptGenerationService.generateFromUrls({
      tenantId: user.tenantId!,
      sourceId: dto.sourceId,
      urls: dto.urls,
    });
  }

  @Post(':id/activate')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.promptsService.activateVersion(id, user.tenantId!, user.role);
  }

  @Get('experiments')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  listExperiments(@CurrentUser() user: AuthenticatedUser) {
    return this.experiments.list(user.tenantId!);
  }

  @Post('experiments')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  createExperiment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExperimentDto,
  ) {
    return this.experiments.create(user.tenantId!, dto);
  }

  @Post('experiments/:id/start')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  startExperiment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.experiments.start(user.tenantId!, id);
  }

  @Post('experiments/:id/pause')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  pauseExperiment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.experiments.pause(user.tenantId!, id);
  }

  @Get('experiments/:id/report')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  experimentReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    const periodDays = days ? parseInt(days, 10) : 7;
    return this.experiments.getReport(user.tenantId!, id, periodDays);
  }
}

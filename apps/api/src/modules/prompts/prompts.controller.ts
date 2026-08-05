import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PromptScope } from '@prisma/client';
import { PromptsService } from './prompts.service';
import { PlaygroundService } from './playground.service';
import { CreatePromptDto, CreateExperimentDto, PlaygroundTestDto } from './dto/prompt.dto';
import {
  CreateRegressionCaseDto,
  RunRegressionDto,
  UpdateRegressionCaseDto,
} from './dto/prompt-regression.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PERMISSIONS } from '../../common/constants/permissions';
import { PromptExperimentService } from './prompt-experiment.service';
import { PromptRegressionService } from './prompt-regression.service';

@Controller('prompts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PromptsController {
  constructor(
    private readonly promptsService: PromptsService,
    private readonly playgroundService: PlaygroundService,
    private readonly experiments: PromptExperimentService,
    private readonly regression: PromptRegressionService,
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

  @Post(':id/activate')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.promptsService.activateVersion(id, user.tenantId!, user.role);
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

  @Get('regression/cases')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  listRegressionCases(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sourceId') sourceId?: string,
  ) {
    return this.regression.listCases(user.tenantId!, sourceId);
  }

  @Post('regression/cases')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  createRegressionCase(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRegressionCaseDto,
  ) {
    return this.regression.createCase(user.tenantId!, dto);
  }

  @Put('regression/cases/:id')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  updateRegressionCase(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRegressionCaseDto,
  ) {
    return this.regression.updateCase(user.tenantId!, id, dto);
  }

  @Delete('regression/cases/:id')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  deleteRegressionCase(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.regression.deleteCase(user.tenantId!, id);
  }

  @Post('regression/run')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  runRegression(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RunRegressionDto,
  ) {
    return this.regression.runAll(user.tenantId!, dto);
  }

  @Get('regression/runs')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  listRegressionRuns(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.regression.listRuns(
      user.tenantId!,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}

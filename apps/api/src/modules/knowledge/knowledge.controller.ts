import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service';
import { StorageService } from './services/storage.service';
import { StartCrawlDto, AddManualTextDto, UpdateManualTextDto } from './dto/knowledge.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { PERMISSIONS } from '../../common/constants/permissions';

@Controller('knowledge')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly storage: StorageService,
  ) {}

  @Post('crawl')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  startCrawl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartCrawlDto,
  ) {
    return this.knowledgeService.startCrawl(
      user.tenantId!,
      dto.sourceId,
      dto.url,
    );
  }

  @Get('documents')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sourceId') sourceId: string,
  ) {
    if (!sourceId) {
      throw new BadRequestException('sourceId обязателен');
    }
    return this.knowledgeService.listDocuments(user.tenantId!, sourceId);
  }

  @Get('jobs')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  listJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sourceId') sourceId: string,
  ) {
    if (!sourceId) {
      throw new BadRequestException('sourceId обязателен');
    }
    return this.knowledgeService.listJobs(user.tenantId!, sourceId);
  }

  @Get('jobs/:id')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  getJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.knowledgeService.getJob(user.tenantId!, id);
  }

  @Post('documents')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sourceId') sourceId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!sourceId) {
      throw new BadRequestException('sourceId обязателен');
    }
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }
    return this.knowledgeService.uploadDocument(
      user.tenantId!,
      sourceId,
      file,
    );
  }

  @Delete('documents/:id')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  async deleteDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const result = await this.knowledgeService.deleteDocument(
      user.tenantId!,
      id,
    );
    if (result.fileKey) {
      await this.storage.delete(result.fileKey);
    }
    return { success: true, deletedChunks: result.deletedChunks };
  }

  @Patch('documents/:id/exclude')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  excludeDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.knowledgeService.excludeDocument(user.tenantId!, id);
  }

  @Post('text')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  addManualText(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddManualTextDto,
  ) {
    return this.knowledgeService.addManualText(
      user.tenantId!,
      dto.sourceId,
      dto.title,
      dto.content,
    );
  }

  @Get('text/:id')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  getManualText(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.knowledgeService.getManualTextContent(user.tenantId!, id);
  }

  @Patch('text/:id')
  @RequirePermission(PERMISSIONS.SOURCES_MANAGE)
  updateManualText(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateManualTextDto,
  ) {
    return this.knowledgeService.updateManualText(
      user.tenantId!,
      id,
      dto.title,
      dto.content,
    );
  }
}

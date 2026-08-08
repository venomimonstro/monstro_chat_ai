import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  mergeSourceConfig,
  patchSourceConfig,
  resolveTrainingConfig,
  type SourceConfig,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { IndexingPipelineService } from './services/indexing-pipeline.service';
import {
  ALLOWED_UPLOAD_MIMES,
  DEFAULT_CRAWL_PAGE_LIMIT,
  MAX_UPLOAD_BYTES_FALLBACK,
  QUEUE_CRAWL_SITE,
  QUEUE_INGEST_DOCUMENT,
} from './constants';
import {
  resolveEffectivePageLimit,
  resolveMaxDepth,
  type CrawlStrategyOptions,
} from './utils/crawl-strategy.util';

export const MANUAL_TEXT_MIME = 'text/manual';

export interface CrawlSiteJobPayload {
  jobId: string;
  tenantId: string;
  sourceId: string;
  rootUrl: string;
  pageLimit: number;
  mode: 'full' | 'incremental';
  crawlOptions: {
    pageLimit: number;
    maxDepth: number;
    strategy: CrawlStrategyOptions;
  };
}

export interface CrawlJobStats {
  mode: 'full' | 'incremental';
  new: number;
  updated: number;
  skipped: number;
  excludedSkipped: number;
  failed: number;
  removed: number;
}

export interface IngestDocumentJobPayload {
  jobId: string;
  tenantId: string;
  documentId: string;
}

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: IndexingPipelineService,
    @InjectQueue(QUEUE_CRAWL_SITE) private readonly crawlQueue: Queue,
    @InjectQueue(QUEUE_INGEST_DOCUMENT) private readonly ingestQueue: Queue,
  ) {}

  async startCrawl(
    tenantId: string,
    sourceId: string,
    url: string,
    mode: 'full' | 'incremental' = 'full',
  ) {
    const source = await this.assertSource(tenantId, sourceId);
    await this.assertNoRunningJob(tenantId, sourceId);

    const tariffLimit = await this.getPageLimit(tenantId);
    const config = mergeSourceConfig(
      source.configJson as Partial<SourceConfig> | null,
    );
    const training = resolveTrainingConfig(config.training);
    const pageLimit = resolveEffectivePageLimit(tariffLimit, training.siteProfile);
    const crawlOptions = this.buildCrawlOptions(training, pageLimit);

    await this.persistCrawlRootUrl(sourceId, config, url);

    const job = await this.prisma.indexingJob.create({
      data: {
        tenantId,
        sourceId,
        type: 'crawl',
        status: 'queued',
        rootUrl: url,
        totalPages: pageLimit,
        statsJson: { mode } as Prisma.InputJsonValue,
      },
    });

    await this.crawlQueue.add(
      'crawl',
      {
        jobId: job.id,
        tenantId,
        sourceId,
        rootUrl: url,
        pageLimit,
        mode,
        crawlOptions,
      } satisfies CrawlSiteJobPayload,
      {
        jobId: job.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    return this.toJobDto(job);
  }

  async startReindex(tenantId: string, sourceId: string) {
    await this.assertSource(tenantId, sourceId);
    await this.assertNoRunningJob(tenantId, sourceId);

    const lastJob = await this.prisma.indexingJob.findFirst({
      where: {
        tenantId,
        sourceId,
        type: 'crawl',
        status: 'completed',
        rootUrl: { not: null },
      },
      orderBy: { completedAt: 'desc' },
    });

    if (!lastJob?.rootUrl) {
      throw new BadRequestException(
        'Нет завершённой индексации — сначала укажите URL и проиндексируйте сайт',
      );
    }

    return this.startCrawl(
      tenantId,
      sourceId,
      lastJob.rootUrl,
      'incremental',
    );
  }

  async getLastCrawl(tenantId: string, sourceId: string) {
    await this.assertSource(tenantId, sourceId);
    const job = await this.prisma.indexingJob.findFirst({
      where: {
        tenantId,
        sourceId,
        type: 'crawl',
        status: 'completed',
        rootUrl: { not: null },
      },
      orderBy: { completedAt: 'desc' },
    });
    if (!job?.rootUrl) return null;
    return {
      rootUrl: job.rootUrl,
      completedAt: job.completedAt?.toISOString() ?? null,
      stats: this.parseCrawlStats(job.statsJson),
    };
  }

  async listDocuments(tenantId: string, sourceId: string) {
    await this.assertSource(tenantId, sourceId);
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: { tenantId, sourceId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return documents.map((doc) => this.toDocumentDto(doc));
  }

  async listJobs(tenantId: string, sourceId: string) {
    await this.assertSource(tenantId, sourceId);
    const jobs = await this.prisma.indexingJob.findMany({
      where: { tenantId, sourceId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return jobs.map((job) => this.toJobDto(job));
  }

  async getJob(tenantId: string, jobId: string) {
    const job = await this.prisma.indexingJob.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Задача индексации не найдена');
    return this.toJobDto(job);
  }

  async uploadDocument(
    tenantId: string,
    sourceId: string,
    file: Express.Multer.File,
  ) {
    await this.assertSource(tenantId, sourceId);
    await this.assertStorageLimit(tenantId, file.size);

    const mime = file.mimetype as (typeof ALLOWED_UPLOAD_MIMES)[number];
    if (!ALLOWED_UPLOAD_MIMES.includes(mime)) {
      throw new BadRequestException(
        `Неподдерживаемый тип файла. Разрешены: PDF, DOCX, TXT, CSV`,
      );
    }

    const job = await this.prisma.indexingJob.create({
      data: {
        tenantId,
        sourceId,
        type: 'ingest',
        status: 'queued',
        totalPages: 1,
      },
    });

    const fileKey = `tenants/${tenantId}/knowledge/${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const document = await this.prisma.knowledgeDocument.create({
      data: {
        tenantId,
        sourceId,
        jobId: job.id,
        type: 'file',
        status: 'pending',
        title: file.originalname,
        fileKey,
        mimeType: mime,
        fileSizeBytes: file.size,
      },
    });

  // Storage upload happens in processor after queue — pass buffer via job
    await this.ingestQueue.add(
      'ingest',
      {
        jobId: job.id,
        tenantId,
        documentId: document.id,
        fileBufferBase64: file.buffer.toString('base64'),
        mimeType: mime,
        fileKey,
      },
      {
        jobId: `ingest-${document.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );

    return this.toDocumentDto(document);
  }

  async deleteDocument(tenantId: string, documentId: string) {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!document) throw new NotFoundException('Документ не найден');

    const chunkCount = await this.prisma.knowledgeChunk.count({
      where: { documentId },
    });

    await this.prisma.knowledgeDocument.delete({ where: { id: documentId } });

    return {
      success: true,
      deletedChunks: chunkCount,
      fileKey: document.fileKey,
    };
  }

  async excludeDocument(tenantId: string, documentId: string) {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!document) throw new NotFoundException('Документ не найден');

    await this.prisma.knowledgeChunk.deleteMany({ where: { documentId } });
    const updated = await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'excluded' },
    });

    return this.toDocumentDto(updated);
  }

  async addManualText(
    tenantId: string,
    sourceId: string,
    title: string,
    content: string,
  ) {
    await this.assertSource(tenantId, sourceId);
    const trimmed = content.trim();
    if (trimmed.length < 20) {
      throw new BadRequestException('Текст знаний должен быть не короче 20 символов');
    }

    const document = await this.prisma.knowledgeDocument.create({
      data: {
        tenantId,
        sourceId,
        type: 'file',
        status: 'processing',
        title: title.trim() || 'Ручная запись',
        mimeType: MANUAL_TEXT_MIME,
      },
    });

    try {
      await this.pipeline.indexDocumentContent(tenantId, document.id, trimmed, {
        title: document.title,
        type: 'manual_text',
      });
      const updated = await this.prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: { status: 'completed', indexedAt: new Date() },
      });
      return this.toDocumentDto(updated);
    } catch (error) {
      await this.prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          status: 'failed',
          errorMessage: String(error),
        },
      });
      throw error;
    }
  }

  async updateManualText(
    tenantId: string,
    documentId: string,
    title: string | undefined,
    content: string,
  ) {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!document) throw new NotFoundException('Документ не найден');
    if (document.mimeType !== MANUAL_TEXT_MIME) {
      throw new BadRequestException('Редактирование доступно только для ручных записей');
    }

    const trimmed = content.trim();
    if (trimmed.length < 20) {
      throw new BadRequestException('Текст знаний должен быть не короче 20 символов');
    }

    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        title: title?.trim() || document.title,
        status: 'processing',
        errorMessage: null,
      },
    });

    try {
      await this.pipeline.indexDocumentContent(tenantId, documentId, trimmed, {
        title: title?.trim() || document.title,
        type: 'manual_text',
      });
      const updated = await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: 'completed', indexedAt: new Date() },
      });
      return this.toDocumentDto(updated);
    } catch (error) {
      await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: 'failed', errorMessage: String(error) },
      });
      throw error;
    }
  }

  async getManualTextContent(tenantId: string, documentId: string) {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: { id: documentId, tenantId, mimeType: MANUAL_TEXT_MIME },
    });
    if (!document) throw new NotFoundException('Ручная запись не найдена');

    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' },
      take: 10000,
    });

    return {
      document: this.toDocumentDto(document),
      content: chunks.map((c) => c.content).join('\n\n'),
    };
  }

  async getPageLimit(tenantId: string): Promise<number> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tariff: true,
        subscriptions: {
          where: { status: { in: ['trialing', 'active'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { tariff: true },
        },
      },
    });

    const tariff =
      tenant?.subscriptions[0]?.tariff ?? tenant?.tariff ?? null;

    if (!tariff) return DEFAULT_CRAWL_PAGE_LIMIT;

    const features = tariff.featuresJson as Record<string, unknown> | null;
    const limit = features?.crawlPageLimit;
    return typeof limit === 'number' && limit > 0
      ? limit
      : DEFAULT_CRAWL_PAGE_LIMIT;
  }

  async getStorageLimitBytes(tenantId: string): Promise<number> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tariff: true,
        subscriptions: {
          where: { status: { in: ['trialing', 'active'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { tariff: true },
        },
      },
    });

    const tariff =
      tenant?.subscriptions[0]?.tariff ?? tenant?.tariff ?? null;
    const mb = tariff?.kbLimitMb ?? MAX_UPLOAD_BYTES_FALLBACK / (1024 * 1024);
    return mb * 1024 * 1024;
  }

  private async assertStorageLimit(tenantId: string, newBytes: number) {
    const limit = await this.getStorageLimitBytes(tenantId);
    const used = await this.prisma.knowledgeDocument.aggregate({
      where: { tenantId, type: 'file' },
      _sum: { fileSizeBytes: true },
    });
    const current = used._sum.fileSizeBytes ?? 0;
    if (current + newBytes > limit) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'LIMIT_EXCEEDED',
        message: 'Превышен лимит объёма базы знаний по тарифу',
        limitBytes: limit,
        currentBytes: current,
      });
    }
  }

  private async persistCrawlRootUrl(
    sourceId: string,
    config: SourceConfig,
    url: string,
  ) {
    const merged = patchSourceConfig(config, {
      training: { ...config.training, crawlRootUrl: url },
    });
    await this.prisma.source.update({
      where: { id: sourceId },
      data: { configJson: merged as unknown as Prisma.InputJsonValue },
    });
  }

  private buildCrawlOptions(
    training: ReturnType<typeof resolveTrainingConfig>,
    pageLimit: number,
  ): CrawlSiteJobPayload['crawlOptions'] {
    const strategy: CrawlStrategyOptions = {
      siteProfile: training.siteProfile,
      excludeBlog: training.excludeBlog,
      priorityUrls: training.priorityUrls,
      excludePatterns: training.excludePatterns,
    };
    return {
      pageLimit,
      maxDepth: resolveMaxDepth(training.siteProfile),
      strategy,
    };
  }

  private async assertSource(tenantId: string, sourceId: string) {
    const source = await this.prisma.source.findFirst({
      where: { id: sourceId, tenantId },
    });
    if (!source) throw new NotFoundException('Источник не найден');
    return source;
  }

  private async assertNoRunningJob(tenantId: string, sourceId: string) {
    const running = await this.prisma.indexingJob.findFirst({
      where: {
        tenantId,
        sourceId,
        status: { in: ['queued', 'running'] },
      },
    });
    if (running) {
      throw new ConflictException(
        'Индексация уже выполняется. Дождитесь завершения текущей задачи.',
      );
    }
  }

  private parseCrawlStats(raw: unknown): CrawlJobStats | null {
    if (!raw || typeof raw !== 'object') return null;
    const s = raw as Record<string, unknown>;
    if (s.mode !== 'full' && s.mode !== 'incremental') return null;
    return {
      mode: s.mode,
      new: Number(s.new ?? 0),
      updated: Number(s.updated ?? 0),
      skipped: Number(s.skipped ?? 0),
      excludedSkipped: Number(s.excludedSkipped ?? 0),
      failed: Number(s.failed ?? 0),
      removed: Number(s.removed ?? 0),
    };
  }

  private toJobDto(job: {
    id: string;
    tenantId: string;
    sourceId: string | null;
    type: string;
    status: string;
    rootUrl: string | null;
    totalPages: number;
    processedPages: number;
    errorMessage: string | null;
    statsJson?: unknown;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: job.id,
      tenantId: job.tenantId,
      sourceId: job.sourceId,
      type: job.type,
      status: job.status,
      rootUrl: job.rootUrl,
      totalPages: job.totalPages,
      processedPages: job.processedPages,
      errorMessage: job.errorMessage,
      stats: this.parseCrawlStats(job.statsJson),
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
    };
  }

  private toDocumentDto(doc: {
    id: string;
    tenantId: string;
    jobId: string | null;
    sourceId: string | null;
    type: string;
    status: string;
    title: string | null;
    url: string | null;
    fileKey: string | null;
    mimeType: string | null;
    fileSizeBytes: number | null;
    errorMessage: string | null;
    indexedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: doc.id,
      tenantId: doc.tenantId,
      jobId: doc.jobId,
      sourceId: doc.sourceId,
      type: doc.type,
      status: doc.status,
      title: doc.title,
      url: doc.url,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes,
      errorMessage: doc.errorMessage,
      indexedAt: doc.indexedAt?.toISOString() ?? null,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ALLOWED_UPLOAD_MIMES,
  DEFAULT_CRAWL_PAGE_LIMIT,
  MAX_UPLOAD_BYTES_FALLBACK,
  QUEUE_CRAWL_SITE,
  QUEUE_INGEST_DOCUMENT,
} from './constants';

export interface CrawlSiteJobPayload {
  jobId: string;
  tenantId: string;
  sourceId: string;
  rootUrl: string;
  pageLimit: number;
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
    @InjectQueue(QUEUE_CRAWL_SITE) private readonly crawlQueue: Queue,
    @InjectQueue(QUEUE_INGEST_DOCUMENT) private readonly ingestQueue: Queue,
  ) {}

  async startCrawl(tenantId: string, sourceId: string, url: string) {
    await this.assertSource(tenantId, sourceId);
    const pageLimit = await this.getPageLimit(tenantId);

    const job = await this.prisma.indexingJob.create({
      data: {
        tenantId,
        sourceId,
        type: 'crawl',
        status: 'queued',
        rootUrl: url,
        totalPages: pageLimit,
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

  async listDocuments(tenantId: string, sourceId: string) {
    await this.assertSource(tenantId, sourceId);
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: { tenantId, sourceId },
      orderBy: { createdAt: 'desc' },
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

  private async assertSource(tenantId: string, sourceId: string) {
    const source = await this.prisma.source.findFirst({
      where: { id: sourceId, tenantId },
    });
    if (!source) throw new NotFoundException('Источник не найден');
    return source;
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

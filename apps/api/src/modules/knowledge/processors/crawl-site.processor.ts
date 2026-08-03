import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { CrawlerService } from '../services/crawler.service';
import { IndexingPipelineService } from '../services/indexing-pipeline.service';
import { IndexingGateway } from '../indexing.gateway';
import {
  CRAWL_JOB_TIMEOUT_MS,
  QUEUE_CRAWL_SITE,
} from '../constants';
import type { CrawlSiteJobPayload } from '../knowledge.service';

@Processor(QUEUE_CRAWL_SITE, {
  concurrency: 2,
  lockDuration: CRAWL_JOB_TIMEOUT_MS,
})
export class CrawlSiteProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlSiteProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawler: CrawlerService,
    private readonly pipeline: IndexingPipelineService,
    private readonly indexingGateway: IndexingGateway,
  ) {
    super();
  }

  async process(job: Job<CrawlSiteJobPayload>): Promise<void> {
    const { jobId, tenantId, sourceId, rootUrl, pageLimit } = job.data;
    const startedAt = Date.now();

    await this.prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date(), errorMessage: null },
    });

    this.emitProgress(tenantId, jobId, 0, pageLimit, 'running');

    try {
      if (Date.now() - startedAt > CRAWL_JOB_TIMEOUT_MS) {
        throw new Error('Превышен таймаут индексации (20 мин)');
      }

      const pages = await this.crawler.crawlSite(
        rootUrl,
        pageLimit,
        async (_page, processed, total) => {
          await this.prisma.indexingJob.update({
            where: { id: jobId },
            data: { processedPages: processed, totalPages: total },
          });
          this.emitProgress(tenantId, jobId, processed, total, 'running');
        },
      );

      await this.prisma.indexingJob.update({
        where: { id: jobId },
        data: { totalPages: pages.length },
      });

      let indexedSuccess = 0;
      const crawlTotal = pages.length;
      let processed = 0;
      for (const page of pages) {
        if (Date.now() - startedAt > CRAWL_JOB_TIMEOUT_MS) {
          throw new Error('Превышен таймаут индексации (20 мин)');
        }

        const existing = await this.prisma.knowledgeDocument.findFirst({
          where: {
            tenantId,
            sourceId,
            type: 'site_page',
            url: page.url,
          },
        });
        if (existing) {
          await this.prisma.knowledgeDocument.delete({ where: { id: existing.id } });
        }

        const document = await this.prisma.knowledgeDocument.create({
          data: {
            tenantId,
            sourceId,
            jobId,
            type: 'site_page',
            status: 'processing',
            title: page.title,
            url: page.url,
          },
        });

        try {
          await this.pipeline.indexDocumentContent(
            tenantId,
            document.id,
            page.text,
            { url: page.url, title: page.title },
          );
          await this.prisma.knowledgeDocument.update({
            where: { id: document.id },
            data: { status: 'completed', indexedAt: new Date() },
          });
          indexedSuccess++;
        } catch (error) {
          await this.prisma.knowledgeDocument.update({
            where: { id: document.id },
            data: {
              status: 'failed',
              errorMessage: String(error),
            },
          });
        }

        processed++;
        const totalPhases = crawlTotal * 2;
        await this.prisma.indexingJob.update({
          where: { id: jobId },
          data: { processedPages: crawlTotal + processed, totalPages: totalPhases },
        });
        this.emitProgress(
          tenantId,
          jobId,
          crawlTotal + processed,
          totalPhases,
          'running',
        );
      }

      if (indexedSuccess === 0) {
        throw new Error('Не удалось проиндексировать ни одной страницы');
      }

      await this.prisma.indexingJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          processedPages: crawlTotal * 2,
          totalPages: crawlTotal * 2,
          completedAt: new Date(),
        },
      });

      this.emitProgress(tenantId, jobId, crawlTotal * 2, crawlTotal * 2, 'completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Crawl job ${jobId} failed: ${message}`);

      await this.prisma.indexingJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errorMessage: message,
          completedAt: new Date(),
        },
      });

      this.emitProgress(
        tenantId,
        jobId,
        0,
        pageLimit,
        'failed',
      );
      return;
    }
  }

  private emitProgress(
    tenantId: string,
    jobId: string,
    processed: number,
    total: number,
    status: string,
  ) {
    this.indexingGateway.emitProgress({
      tenantId,
      jobId,
      processed,
      total,
      status,
    });
  }
}

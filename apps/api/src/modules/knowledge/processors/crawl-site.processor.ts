import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CrawlerService } from '../services/crawler.service';
import { IndexingPipelineService } from '../services/indexing-pipeline.service';
import { IndexingGateway } from '../indexing.gateway';
import {
  CRAWL_JOB_TIMEOUT_MS,
  QUEUE_CRAWL_SITE,
} from '../constants';
import type { CrawlJobStats, CrawlSiteJobPayload } from '../knowledge.service';
import { hashPageContent } from '../utils/content-hash';

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
    const { jobId, tenantId, sourceId, rootUrl, pageLimit, mode, crawlOptions } =
      job.data;
    const crawlMode = mode ?? 'full';
    const options =
      crawlOptions ??
      ({
        pageLimit,
        maxDepth: 4,
        strategy: {
          siteProfile: 'auto',
          excludeBlog: true,
          priorityUrls: [],
          excludePatterns: [],
        },
      } satisfies CrawlSiteJobPayload['crawlOptions']);
    const startedAt = Date.now();
    const stats: CrawlJobStats = {
      mode: crawlMode,
      new: 0,
      updated: 0,
      skipped: 0,
      excludedSkipped: 0,
      failed: 0,
      removed: 0,
    };

    await this.prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status: 'running',
        startedAt: new Date(),
        errorMessage: null,
        statsJson: stats as unknown as Prisma.InputJsonValue,
      },
    });

    this.emitProgress(tenantId, jobId, 0, pageLimit, 'running');

    try {
      if (Date.now() - startedAt > CRAWL_JOB_TIMEOUT_MS) {
        throw new Error('Превышен таймаут индексации (20 мин)');
      }

      const pages = await this.crawler.crawlSite(
        rootUrl,
        options,
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
      const crawledUrls = new Set<string>();

      for (const page of pages) {
        if (Date.now() - startedAt > CRAWL_JOB_TIMEOUT_MS) {
          throw new Error('Превышен таймаут индексации (20 мин)');
        }

        crawledUrls.add(page.url);
        const contentHash = hashPageContent(page.text);

        const existing = await this.prisma.knowledgeDocument.findFirst({
          where: {
            tenantId,
            sourceId,
            type: 'site_page',
            url: page.url,
          },
        });

        if (existing?.status === 'excluded') {
          stats.excludedSkipped++;
          processed++;
          await this.tickProgress(
            jobId,
            tenantId,
            crawlTotal,
            processed,
            stats,
          );
          continue;
        }

        if (
          crawlMode === 'incremental' &&
          existing?.status === 'completed' &&
          existing.contentHash === contentHash
        ) {
          await this.prisma.knowledgeDocument.update({
            where: { id: existing.id },
            data: { jobId, indexedAt: new Date() },
          });
          stats.skipped++;
          indexedSuccess++;
          processed++;
          await this.tickProgress(
            jobId,
            tenantId,
            crawlTotal,
            processed,
            stats,
          );
          continue;
        }

        let documentId: string;
        if (existing) {
          await this.prisma.knowledgeDocument.update({
            where: { id: existing.id },
            data: {
              jobId,
              status: 'processing',
              title: page.title,
              errorMessage: null,
            },
          });
          documentId = existing.id;
          stats.updated++;
        } else {
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
          documentId = document.id;
          stats.new++;
        }

        try {
          await this.pipeline.indexDocumentContent(
            tenantId,
            documentId,
            page.text,
            { url: page.url, title: page.title },
          );
          await this.prisma.knowledgeDocument.update({
            where: { id: documentId },
            data: {
              status: 'completed',
              indexedAt: new Date(),
              contentHash,
            },
          });
          indexedSuccess++;
        } catch (error) {
          stats.failed++;
          await this.prisma.knowledgeDocument.update({
            where: { id: documentId },
            data: {
              status: 'failed',
              errorMessage: String(error),
            },
          });
        }

        processed++;
        await this.tickProgress(jobId, tenantId, crawlTotal, processed, stats);
      }

      const orphans = await this.prisma.knowledgeDocument.findMany({
        where: {
          tenantId,
          sourceId,
          type: 'site_page',
          status: { not: 'excluded' },
          url: { notIn: [...crawledUrls] },
        },
        select: { id: true },
      });

      for (const orphan of orphans) {
        await this.prisma.knowledgeDocument.delete({ where: { id: orphan.id } });
        stats.removed++;
      }

      const hasUsableKnowledge =
        indexedSuccess > 0 || stats.skipped > 0 || stats.excludedSkipped > 0;

      if (!hasUsableKnowledge && pages.length > 0) {
        throw new Error('Не удалось проиндексировать ни одной страницы');
      }

      await this.prisma.indexingJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          processedPages: crawlTotal * 2,
          totalPages: crawlTotal * 2,
          completedAt: new Date(),
          statsJson: stats as unknown as Prisma.InputJsonValue,
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
          statsJson: stats as unknown as Prisma.InputJsonValue,
        },
      });

      this.emitProgress(tenantId, jobId, 0, pageLimit, 'failed');
    }
  }

  private async tickProgress(
    jobId: string,
    tenantId: string,
    crawlTotal: number,
    processed: number,
    stats: CrawlJobStats,
  ) {
    const totalPhases = crawlTotal * 2;
    await this.prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        processedPages: crawlTotal + processed,
        totalPages: totalPhases,
        statsJson: stats as unknown as Prisma.InputJsonValue,
      },
    });
    this.emitProgress(
      tenantId,
      jobId,
      crawlTotal + processed,
      totalPhases,
      'running',
    );
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

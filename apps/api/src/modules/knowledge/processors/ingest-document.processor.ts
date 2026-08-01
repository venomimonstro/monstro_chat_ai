import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../services/storage.service';
import { DocumentParserService } from '../services/document-parser.service';
import { IndexingPipelineService } from '../services/indexing-pipeline.service';
import { IndexingGateway } from '../indexing.gateway';
import { QUEUE_INGEST_DOCUMENT } from '../constants';

export interface IngestDocumentJobPayload {
  jobId: string;
  tenantId: string;
  documentId: string;
  fileKey: string;
  mimeType: string;
  fileBufferBase64: string;
}

@Processor(QUEUE_INGEST_DOCUMENT, { concurrency: 3 })
export class IngestDocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestDocumentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly parser: DocumentParserService,
    private readonly pipeline: IndexingPipelineService,
    private readonly indexingGateway: IndexingGateway,
  ) {
    super();
  }

  async process(job: Job<IngestDocumentJobPayload>): Promise<void> {
    const { jobId, tenantId, documentId, fileKey, mimeType, fileBufferBase64 } =
      job.data;

    await this.prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date() },
    });

    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: 'processing' },
    });

    this.indexingGateway.emitProgress({
      tenantId,
      jobId,
      processed: 0,
      total: 1,
      status: 'running',
    });

    try {
      const buffer = Buffer.from(fileBufferBase64, 'base64');
      await this.storage.upload(fileKey, buffer, mimeType);

      const text = await this.parser.extractText(buffer, mimeType);
      if (!text) {
        throw new Error('Не удалось извлечь текст из файла');
      }

      await this.pipeline.indexDocumentContent(tenantId, documentId, text, {
        mimeType,
        fileKey,
      });

      await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: 'completed', indexedAt: new Date() },
      });

      await this.prisma.indexingJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          processedPages: 1,
          totalPages: 1,
          completedAt: new Date(),
        },
      });

      this.indexingGateway.emitProgress({
        tenantId,
        jobId,
        processed: 1,
        total: 1,
        status: 'completed',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Ingest job ${jobId} failed: ${message}`);

      await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: 'failed', errorMessage: message },
      });

      await this.prisma.indexingJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errorMessage: message,
          completedAt: new Date(),
        },
      });

      this.indexingGateway.emitProgress({
        tenantId,
        jobId,
        processed: 0,
        total: 1,
        status: 'failed',
      });

      throw error;
    }
  }
}

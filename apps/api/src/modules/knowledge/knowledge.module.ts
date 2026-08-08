import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { IndexingGateway } from './indexing.gateway';
import { ChunkingService } from './services/chunking.service';
import { EmbeddingService } from './services/embedding.service';
import { CrawlerService } from './services/crawler.service';
import { DocumentParserService } from './services/document-parser.service';
import { StorageService } from './services/storage.service';
import { IndexingPipelineService } from './services/indexing-pipeline.service';
import { CrawlSiteProcessor } from './processors/crawl-site.processor';
import { IngestDocumentProcessor } from './processors/ingest-document.processor';
import { QUEUE_CRAWL_SITE, QUEUE_INGEST_DOCUMENT } from './constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_CRAWL_SITE },
      { name: QUEUE_INGEST_DOCUMENT },
    ),
    JwtModule.register({}),
  ],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeService,
    IndexingGateway,
    ChunkingService,
    EmbeddingService,
    CrawlerService,
    DocumentParserService,
    StorageService,
    IndexingPipelineService,
    CrawlSiteProcessor,
    IngestDocumentProcessor,
  ],
  exports: [
    KnowledgeService,
    IndexingPipelineService,
    EmbeddingService,
    CrawlerService,
  ],
})
export class KnowledgeModule {}

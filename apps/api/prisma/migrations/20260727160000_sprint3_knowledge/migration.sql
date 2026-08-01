-- CreateEnum
CREATE TYPE "IndexingJobStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "IndexingJobType" AS ENUM ('crawl', 'ingest');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('site_page', 'file');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'excluded');

-- CreateTable
CREATE TABLE "indexing_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_id" UUID,
    "type" "IndexingJobType" NOT NULL,
    "status" "IndexingJobStatus" NOT NULL DEFAULT 'queued',
    "root_url" TEXT,
    "total_pages" INTEGER NOT NULL DEFAULT 0,
    "processed_pages" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "job_id" UUID,
    "source_id" UUID,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'pending',
    "title" TEXT,
    "url" TEXT,
    "file_key" TEXT,
    "mime_type" TEXT,
    "file_size_bytes" INTEGER,
    "error_message" TEXT,
    "indexed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "indexing_jobs_tenant_id_idx" ON "indexing_jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_tenant_id_idx" ON "knowledge_documents"("tenant_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_job_id_idx" ON "knowledge_documents"("job_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_tenant_id_idx" ON "knowledge_chunks"("tenant_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks"("document_id");

-- AddForeignKey
ALTER TABLE "indexing_jobs" ADD CONSTRAINT "indexing_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indexing_jobs" ADD CONSTRAINT "indexing_jobs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "indexing_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE indexing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY indexing_job_tenant_isolation ON indexing_jobs
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY knowledge_document_tenant_isolation ON knowledge_documents
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY knowledge_chunk_tenant_isolation ON knowledge_chunks
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- Vector index for similarity search (Sprint 4+)
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

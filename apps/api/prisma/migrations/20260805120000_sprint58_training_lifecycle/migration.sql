-- Sprint 58: training lifecycle — content hash for incremental crawl, job stats
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "content_hash" TEXT;

ALTER TABLE "indexing_jobs" ADD COLUMN IF NOT EXISTS "stats_json" JSONB;

CREATE INDEX IF NOT EXISTS "knowledge_documents_tenant_source_url_idx"
  ON "knowledge_documents"("tenant_id", "source_id", "url");

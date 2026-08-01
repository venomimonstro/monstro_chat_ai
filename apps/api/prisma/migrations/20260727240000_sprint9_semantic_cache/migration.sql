-- CreateTable
CREATE TABLE "semantic_cache_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "embedding" vector(1536),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semantic_cache_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "semantic_cache_entries_tenant_id_idx" ON "semantic_cache_entries"("tenant_id");

-- CreateIndex
CREATE INDEX "semantic_cache_entries_expires_at_idx" ON "semantic_cache_entries"("expires_at");

-- AddForeignKey
ALTER TABLE "semantic_cache_entries" ADD CONSTRAINT "semantic_cache_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

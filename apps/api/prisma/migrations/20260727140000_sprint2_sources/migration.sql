-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('website', 'vk', 'telegram');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "SourceType" NOT NULL DEFAULT 'website',
    "name" TEXT NOT NULL,
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "config_version" INTEGER NOT NULL DEFAULT 1,
    "widget_key" TEXT NOT NULL,
    "status" "SourceStatus" NOT NULL DEFAULT 'active',
    "script_installed_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_widget_key_key" ON "sources"("widget_key");

-- CreateIndex
CREATE INDEX "sources_tenant_id_idx" ON "sources"("tenant_id");

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS for sources
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY source_tenant_isolation ON sources
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

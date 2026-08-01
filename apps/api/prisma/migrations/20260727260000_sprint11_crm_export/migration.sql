-- CreateEnum
CREATE TYPE "LeadSyncStatus" AS ENUM ('not_required', 'pending', 'synced', 'failed');

-- CreateEnum
CREATE TYPE "WebhookDirection" AS ENUM ('in', 'out');

-- CreateEnum
CREATE TYPE "WebhookLogStatus" AS ENUM ('pending', 'success', 'failed', 'retrying');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "external_id" TEXT,
ADD COLUMN "external_crm_type" "IntegrationType",
ADD COLUMN "sync_status" "LeadSyncStatus" NOT NULL DEFAULT 'not_required',
ADD COLUMN "sync_error" TEXT,
ADD COLUMN "last_sync_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "leads_sync_status_idx" ON "leads"("sync_status");

-- CreateTable
CREATE TABLE "field_mappings" (
    "id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "internal_field" TEXT NOT NULL,
    "external_field" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID,
    "lead_id" UUID,
    "direction" "WebhookDirection" NOT NULL,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "status" "WebhookLogStatus" NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_mappings_integration_id_idx" ON "field_mappings"("integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_mappings_integration_id_internal_field_key" ON "field_mappings"("integration_id", "internal_field");

-- CreateIndex
CREATE INDEX "webhook_logs_tenant_id_idx" ON "webhook_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "webhook_logs_lead_id_idx" ON "webhook_logs"("lead_id");

-- CreateIndex
CREATE INDEX "webhook_logs_integration_id_idx" ON "webhook_logs"("integration_id");

-- AddForeignKey
ALTER TABLE "field_mappings" ADD CONSTRAINT "field_mappings_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

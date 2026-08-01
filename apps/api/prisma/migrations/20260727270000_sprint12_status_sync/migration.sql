-- CreateTable
CREATE TABLE "status_mappings" (
    "id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "internal_status_id" UUID NOT NULL,
    "external_status_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "status_mappings_integration_id_idx" ON "status_mappings"("integration_id");

-- CreateIndex
CREATE INDEX "status_mappings_internal_status_id_idx" ON "status_mappings"("internal_status_id");

-- CreateIndex
CREATE UNIQUE INDEX "status_mappings_integration_id_internal_status_id_key" ON "status_mappings"("integration_id", "internal_status_id");

-- AddForeignKey
ALTER TABLE "status_mappings" ADD CONSTRAINT "status_mappings_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_mappings" ADD CONSTRAINT "status_mappings_internal_status_id_fkey" FOREIGN KEY ("internal_status_id") REFERENCES "pipeline_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable leads
ALTER TABLE "leads" ADD COLUMN "pipeline_id" UUID;
ALTER TABLE "leads" ADD COLUMN "status_id" UUID;
ALTER TABLE "leads" ADD COLUMN "assigned_user_id" UUID;
ALTER TABLE "leads" ADD COLUMN "merged_into_id" UUID;
ALTER TABLE "leads" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "leads" ADD COLUMN "notes" TEXT;
ALTER TABLE "leads" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "pipelines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_statuses" (
    "id" UUID NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_status_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "from_status_id" UUID,
    "to_status_id" UUID NOT NULL,
    "changed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipelines_tenant_id_idx" ON "pipelines"("tenant_id");

-- CreateIndex
CREATE INDEX "pipeline_statuses_pipeline_id_idx" ON "pipeline_statuses"("pipeline_id");

-- CreateIndex
CREATE INDEX "leads_status_id_idx" ON "leads"("status_id");

-- CreateIndex
CREATE INDEX "leads_pipeline_id_idx" ON "leads"("pipeline_id");

-- CreateIndex
CREATE INDEX "lead_status_history_tenant_id_idx" ON "lead_status_history"("tenant_id");

-- CreateIndex
CREATE INDEX "lead_status_history_lead_id_idx" ON "lead_status_history"("lead_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "pipeline_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_statuses" ADD CONSTRAINT "pipeline_statuses_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "pipeline_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "pipeline_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY pipeline_tenant_isolation ON pipelines
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY pipeline_status_tenant_isolation ON pipeline_statuses
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR pipeline_id IN (
      SELECT id FROM pipelines WHERE tenant_id::text = current_setting('app.current_tenant_id', true)
    )
  );

CREATE POLICY lead_status_history_tenant_isolation ON lead_status_history
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

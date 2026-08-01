-- CreateEnum
CREATE TYPE "PromptScope" AS ENUM ('global', 'tenant');

-- CreateTable
CREATE TABLE "prompts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "scope" "PromptScope" NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "dialog_id" UUID NOT NULL,
    "source_id" UUID,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_dialog_id_key" ON "leads"("dialog_id");

-- CreateIndex
CREATE INDEX "prompts_tenant_id_idx" ON "prompts"("tenant_id");

-- CreateIndex
CREATE INDEX "prompts_scope_tenant_id_idx" ON "prompts"("scope", "tenant_id");

-- CreateIndex
CREATE INDEX "leads_tenant_id_idx" ON "leads"("tenant_id");

-- CreateIndex
CREATE INDEX "leads_phone_idx" ON "leads"("phone");

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_dialog_id_fkey" FOREIGN KEY ("dialog_id") REFERENCES "dialogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY prompt_tenant_isolation ON prompts
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR tenant_id IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY lead_tenant_isolation ON leads
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

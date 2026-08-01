-- CreateEnum
CREATE TYPE "DialogStatus" AS ENUM ('active', 'closed');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system', 'manager');

-- CreateTable
CREATE TABLE "dialogs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "summary" TEXT,
    "utm_json" JSONB NOT NULL DEFAULT '{}',
    "status" "DialogStatus" NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dialogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "dialog_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "provider" TEXT,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_usage_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "dialog_id" UUID,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "cost_usd" DECIMAL(12,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dialogs_tenant_id_idx" ON "dialogs"("tenant_id");

-- CreateIndex
CREATE INDEX "dialogs_source_id_idx" ON "dialogs"("source_id");

-- CreateIndex
CREATE INDEX "dialogs_visitor_id_idx" ON "dialogs"("visitor_id");

-- CreateIndex
CREATE INDEX "messages_dialog_id_idx" ON "messages"("dialog_id");

-- CreateIndex
CREATE INDEX "messages_tenant_id_idx" ON "messages"("tenant_id");

-- CreateIndex
CREATE INDEX "llm_usage_logs_tenant_id_idx" ON "llm_usage_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "llm_usage_logs_dialog_id_idx" ON "llm_usage_logs"("dialog_id");

-- AddForeignKey
ALTER TABLE "dialogs" ADD CONSTRAINT "dialogs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dialogs" ADD CONSTRAINT "dialogs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_dialog_id_fkey" FOREIGN KEY ("dialog_id") REFERENCES "dialogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_usage_logs" ADD CONSTRAINT "llm_usage_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_usage_logs" ADD CONSTRAINT "llm_usage_logs_dialog_id_fkey" FOREIGN KEY ("dialog_id") REFERENCES "dialogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS
ALTER TABLE dialogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY dialog_tenant_isolation ON dialogs
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY message_tenant_isolation ON messages
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY llm_usage_log_tenant_isolation ON llm_usage_logs
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

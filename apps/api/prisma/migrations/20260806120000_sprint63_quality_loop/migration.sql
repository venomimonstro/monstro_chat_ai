-- Sprint 63: Quality Loop — message feedback and prompt regression tests

CREATE TYPE "MessageFeedbackRating" AS ENUM ('up', 'down');

CREATE TABLE "message_feedback" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "message_id" UUID NOT NULL,
  "dialog_id" UUID NOT NULL,
  "source_id" UUID,
  "rating" "MessageFeedbackRating" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "message_feedback_message_id_key" ON "message_feedback"("message_id");
CREATE INDEX "message_feedback_tenant_rating_idx" ON "message_feedback"("tenant_id", "rating");
CREATE INDEX "message_feedback_dialog_id_idx" ON "message_feedback"("dialog_id");

ALTER TABLE "message_feedback"
  ADD CONSTRAINT "message_feedback_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_feedback"
  ADD CONSTRAINT "message_feedback_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_feedback"
  ADD CONSTRAINT "message_feedback_dialog_id_fkey"
  FOREIGN KEY ("dialog_id") REFERENCES "dialogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_feedback"
  ADD CONSTRAINT "message_feedback_source_id_fkey"
  FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "prompt_regression_cases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "source_id" UUID,
  "name" TEXT NOT NULL,
  "user_message" TEXT NOT NULL,
  "assertions_json" JSONB NOT NULL DEFAULT '{}',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prompt_regression_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "prompt_regression_cases_tenant_id_idx" ON "prompt_regression_cases"("tenant_id");

ALTER TABLE "prompt_regression_cases"
  ADD CONSTRAINT "prompt_regression_cases_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prompt_regression_cases"
  ADD CONSTRAINT "prompt_regression_cases_source_id_fkey"
  FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "prompt_regression_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "source_id" UUID,
  "prompt_id" UUID,
  "passed" INTEGER NOT NULL,
  "failed" INTEGER NOT NULL,
  "results_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prompt_regression_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "prompt_regression_runs_tenant_id_idx" ON "prompt_regression_runs"("tenant_id");

ALTER TABLE "prompt_regression_runs"
  ADD CONSTRAINT "prompt_regression_runs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prompt_regression_runs"
  ADD CONSTRAINT "prompt_regression_runs_prompt_id_fkey"
  FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

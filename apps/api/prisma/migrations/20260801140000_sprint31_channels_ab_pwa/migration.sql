-- Sprint 31: A/B prompts, push subscriptions

CREATE TYPE "PromptExperimentStatus" AS ENUM ('draft', 'running', 'paused', 'completed');

CREATE TABLE "prompt_experiments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prompt_a_id" UUID NOT NULL,
    "prompt_b_id" UUID NOT NULL,
    "traffic_b_percent" INTEGER NOT NULL DEFAULT 50,
    "status" "PromptExperimentStatus" NOT NULL DEFAULT 'draft',
    "min_sample_size" INTEGER NOT NULL DEFAULT 100,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_experiments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dialog_experiment_assignments" (
    "id" UUID NOT NULL,
    "experiment_id" UUID NOT NULL,
    "dialog_id" UUID NOT NULL,
    "variant" TEXT NOT NULL,
    "converted_to_lead" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dialog_experiment_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dialog_experiment_assignments_dialog_id_key" ON "dialog_experiment_assignments"("dialog_id");
CREATE INDEX "dialog_experiment_assignments_experiment_id_idx" ON "dialog_experiment_assignments"("experiment_id");
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_tenant_id_idx" ON "push_subscriptions"("tenant_id");
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
CREATE INDEX "prompt_experiments_tenant_id_idx" ON "prompt_experiments"("tenant_id");

ALTER TABLE "prompt_experiments" ADD CONSTRAINT "prompt_experiments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prompt_experiments" ADD CONSTRAINT "prompt_experiments_prompt_a_id_fkey" FOREIGN KEY ("prompt_a_id") REFERENCES "prompts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prompt_experiments" ADD CONSTRAINT "prompt_experiments_prompt_b_id_fkey" FOREIGN KEY ("prompt_b_id") REFERENCES "prompts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dialog_experiment_assignments" ADD CONSTRAINT "dialog_experiment_assignments_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "prompt_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dialog_experiment_assignments" ADD CONSTRAINT "dialog_experiment_assignments_dialog_id_fkey" FOREIGN KEY ("dialog_id") REFERENCES "dialogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

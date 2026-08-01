-- CreateEnum
CREATE TYPE "OveragePolicy" AS ENUM ('block', 'charge', 'allow');

-- AlterTable
ALTER TABLE "tariffs" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB';
ALTER TABLE "tariffs" ADD COLUMN "overage_policy" "OveragePolicy" NOT NULL DEFAULT 'block';

-- CreateTable
CREATE TABLE "usage_counters" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period_key" TEXT NOT NULL,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period_key" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_counters_tenant_id_idx" ON "usage_counters"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_counters_tenant_id_period_key_key" ON "usage_counters"("tenant_id", "period_key");

-- CreateIndex
CREATE INDEX "usage_notifications_tenant_id_idx" ON "usage_notifications"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_notifications_tenant_id_period_key_threshold_key" ON "usage_notifications"("tenant_id", "period_key", "threshold");

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_notifications" ADD CONSTRAINT "usage_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

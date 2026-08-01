-- CreateEnum
CREATE TYPE "LeadDeliveryChannelType" AS ENUM ('telegram', 'email', 'google_sheets', 'amocrm', 'bitrix24');

-- CreateTable
CREATE TABLE "lead_delivery_channels" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "LeadDeliveryChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "credentials_encrypted" TEXT,
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_delivery_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_delivery_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "lead_id" UUID,
    "status" "WebhookLogStatus" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_delivery_channels_tenant_id_idx" ON "lead_delivery_channels"("tenant_id");

-- CreateIndex
CREATE INDEX "lead_delivery_channels_tenant_id_enabled_idx" ON "lead_delivery_channels"("tenant_id", "enabled");

-- CreateIndex
CREATE INDEX "lead_delivery_logs_tenant_id_idx" ON "lead_delivery_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "lead_delivery_logs_channel_id_idx" ON "lead_delivery_logs"("channel_id");

-- CreateIndex
CREATE INDEX "lead_delivery_logs_lead_id_idx" ON "lead_delivery_logs"("lead_id");

-- AddForeignKey
ALTER TABLE "lead_delivery_channels" ADD CONSTRAINT "lead_delivery_channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_delivery_logs" ADD CONSTRAINT "lead_delivery_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_delivery_logs" ADD CONSTRAINT "lead_delivery_logs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "lead_delivery_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_delivery_logs" ADD CONSTRAINT "lead_delivery_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

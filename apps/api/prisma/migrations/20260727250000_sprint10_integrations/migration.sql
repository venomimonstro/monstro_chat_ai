-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('metrika', 'gtm', 'ga4', 'amocrm', 'bitrix24');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "dialogs" ADD COLUMN "referrer" TEXT,
ADD COLUMN "landing_page" TEXT,
ADD COLUMN "yandex_client_id" TEXT,
ADD COLUMN "ga_client_id" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "utm_json" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "referrer" TEXT,
ADD COLUMN "landing_page" TEXT,
ADD COLUMN "yandex_client_id" TEXT,
ADD COLUMN "ga_client_id" TEXT;

-- CreateTable
CREATE TABLE "integrations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "credentials_encrypted" TEXT,
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "status" "IntegrationStatus" NOT NULL DEFAULT 'inactive',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integrations_tenant_id_idx" ON "integrations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_tenant_id_type_key" ON "integrations"("tenant_id", "type");

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

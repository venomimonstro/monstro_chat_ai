-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'admin', 'client', 'manager');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'trial_expired');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'paused');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "owner_user_id" UUID,
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "trial_ends_at" TIMESTAMP(3),
    "tariff_id" UUID,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'client',
    "tenant_id" UUID,
    "two_fa_secret" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariffs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'month',
    "message_limit" INTEGER NOT NULL,
    "source_limit" INTEGER NOT NULL,
    "kb_limit_mb" INTEGER NOT NULL DEFAULT 100,
    "features_json" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tariff_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "current_period_end" TIMESTAMP(3),
    "payment_method_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "tariffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "tariffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security (defense in depth for multi-tenant isolation)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenants
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR id::text = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY user_tenant_isolation ON users
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY subscription_tenant_isolation ON subscriptions
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- Seed default tariffs
INSERT INTO tariffs (id, name, price, period, message_limit, source_limit, kb_limit_mb, features_json, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Start', 990.00, 'month', 500, 1, 50, '{"integrations": false}', true, NOW(), NOW()),
  (gen_random_uuid(), 'Business', 2990.00, 'month', 3000, 3, 200, '{"integrations": true}', true, NOW(), NOW()),
  (gen_random_uuid(), 'Pro', 7990.00, 'month', 15000, 10, 1000, '{"integrations": true, "priority": true}', true, NOW(), NOW()),
  (gen_random_uuid(), 'Enterprise', 19990.00, 'month', 100000, 50, 5000, '{"integrations": true, "priority": true, "dedicated": true}', true, NOW(), NOW());

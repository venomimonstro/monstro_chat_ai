-- CreateEnum
CREATE TYPE "AnalyticsDashboardScope" AS ENUM ('admin', 'tenant');

-- CreateTable
CREATE TABLE "analytics_dashboards" (
    "id" UUID NOT NULL,
    "scope" "AnalyticsDashboardScope" NOT NULL,
    "tenant_id" UUID,
    "name" TEXT NOT NULL,
    "widgets_json" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_report_schedules" (
    "id" UUID NOT NULL,
    "dashboard_id" UUID NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "cron_hour" INTEGER NOT NULL,
    "cron_minute" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_dashboards_scope_idx" ON "analytics_dashboards"("scope");

-- CreateIndex
CREATE INDEX "analytics_dashboards_tenant_id_idx" ON "analytics_dashboards"("tenant_id");

-- CreateIndex
CREATE INDEX "analytics_report_schedules_dashboard_id_idx" ON "analytics_report_schedules"("dashboard_id");

-- AddForeignKey
ALTER TABLE "analytics_dashboards" ADD CONSTRAINT "analytics_dashboards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_report_schedules" ADD CONSTRAINT "analytics_report_schedules_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "analytics_dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Permissions
INSERT INTO permissions (id, code, description, created_at) VALUES
  (gen_random_uuid(), 'admin.analytics.view', 'Просмотр платформенной аналитики', NOW()),
  (gen_random_uuid(), 'admin.analytics.manage', 'Управление дашбордами аналитики', NOW()),
  (gen_random_uuid(), 'analytics.view', 'Просмотр статистики тенанта', NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role, permission_id, created_at)
SELECT gen_random_uuid(), 'owner', id, NOW() FROM permissions
WHERE code IN ('admin.analytics.view', 'admin.analytics.manage', 'analytics.view')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role, permission_id, created_at)
SELECT gen_random_uuid(), 'admin', id, NOW() FROM permissions
WHERE code IN ('admin.analytics.view', 'admin.analytics.manage')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role, permission_id, created_at)
SELECT gen_random_uuid(), 'client', id, NOW() FROM permissions
WHERE code = 'analytics.view'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role, permission_id, created_at)
SELECT gen_random_uuid(), 'manager', id, NOW() FROM permissions
WHERE code = 'analytics.view'
ON CONFLICT (role, permission_id) DO NOTHING;

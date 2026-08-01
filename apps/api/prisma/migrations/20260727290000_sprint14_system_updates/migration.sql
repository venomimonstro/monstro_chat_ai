-- CreateEnum
CREATE TYPE "SystemUpdateStatus" AS ENUM (
  'pending',
  'testing',
  'test_passed',
  'test_failed',
  'awaiting_approval',
  'deploying',
  'canary_monitoring',
  'applied',
  'rolled_back'
);

-- CreateTable
CREATE TABLE "backup_snapshots" (
    "id" UUID NOT NULL,
    "label" TEXT,
    "storage_path" TEXT NOT NULL,
    "size_bytes" BIGINT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_updates" (
    "id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "changelog" TEXT,
    "git_sha" TEXT,
    "image_tag" TEXT,
    "status" "SystemUpdateStatus" NOT NULL DEFAULT 'pending',
    "test_report_json" JSONB,
    "deploy_log_json" JSONB,
    "canary_metrics_json" JSONB,
    "backup_snapshot_id" UUID,
    "applied_at" TIMESTAMP(3),
    "rollback_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_updates_version_key" ON "system_updates"("version");

-- CreateIndex
CREATE INDEX "backup_snapshots_created_at_idx" ON "backup_snapshots"("created_at");

-- CreateIndex
CREATE INDEX "system_updates_status_idx" ON "system_updates"("status");

-- CreateIndex
CREATE INDEX "system_updates_created_at_idx" ON "system_updates"("created_at");

-- AddForeignKey
ALTER TABLE "system_updates" ADD CONSTRAINT "system_updates_backup_snapshot_id_fkey" FOREIGN KEY ("backup_snapshot_id") REFERENCES "backup_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Permissions for system updates
INSERT INTO permissions (id, code, description, created_at) VALUES
  (gen_random_uuid(), 'admin.updates.view', 'Просмотр обновлений системы', NOW()),
  (gen_random_uuid(), 'admin.updates.manage', 'Управление обновлениями системы', NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role, permission_id, created_at)
SELECT gen_random_uuid(), 'owner', id, NOW() FROM permissions
WHERE code IN ('admin.updates.view', 'admin.updates.manage')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role, permission_id, created_at)
SELECT gen_random_uuid(), 'admin', id, NOW() FROM permissions
WHERE code IN ('admin.updates.view', 'admin.updates.manage')
ON CONFLICT (role, permission_id) DO NOTHING;

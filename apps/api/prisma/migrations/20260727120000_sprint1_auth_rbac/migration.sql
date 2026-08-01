-- AlterTable
ALTER TABLE "users" ADD COLUMN "two_fa_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permission_id_key" ON "role_permissions"("role", "permission_id");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed permissions
INSERT INTO permissions (id, code, description, created_at) VALUES
  (gen_random_uuid(), 'crm.leads.view', 'Просмотр лидов', NOW()),
  (gen_random_uuid(), 'crm.leads.edit', 'Редактирование лидов', NOW()),
  (gen_random_uuid(), 'sources.manage', 'Управление источниками', NOW()),
  (gen_random_uuid(), 'chats.view', 'Просмотр чатов', NOW()),
  (gen_random_uuid(), 'settings.manage', 'Управление настройками', NOW()),
  (gen_random_uuid(), 'admin.tenants.view', 'Просмотр клиентов (админ)', NOW()),
  (gen_random_uuid(), 'admin.tenants.manage', 'Управление клиентами (админ)', NOW());

-- Client permissions
INSERT INTO role_permissions (id, role, permission_id, created_at)
SELECT gen_random_uuid(), 'client', id, NOW() FROM permissions
WHERE code IN ('crm.leads.view', 'crm.leads.edit', 'sources.manage', 'chats.view', 'settings.manage');

-- Manager permissions
INSERT INTO role_permissions (id, role, permission_id, created_at)
SELECT gen_random_uuid(), 'manager', id, NOW() FROM permissions
WHERE code IN ('crm.leads.view', 'crm.leads.edit', 'chats.view');

-- Admin permissions (all except super-admin)
INSERT INTO role_permissions (id, role, permission_id, created_at)
SELECT gen_random_uuid(), 'admin', id, NOW() FROM permissions;

-- Owner permissions (all)
INSERT INTO role_permissions (id, role, permission_id, created_at)
SELECT gen_random_uuid(), 'owner', id, NOW() FROM permissions;

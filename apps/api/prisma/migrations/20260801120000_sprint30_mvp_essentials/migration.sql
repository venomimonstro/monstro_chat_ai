-- Sprint 30: MVP essentials

CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_invites" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'manager',
    "token_hash" TEXT NOT NULL,
    "invited_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_invites_token_hash_key" ON "user_invites"("token_hash");
CREATE INDEX "user_invites_tenant_id_idx" ON "user_invites"("tenant_id");
CREATE INDEX "user_invites_email_idx" ON "user_invites"("email");

ALTER TABLE "user_invites"
  ADD CONSTRAINT "user_invites_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_invites"
  ADD CONSTRAINT "user_invites_invited_by_id_fkey"
  FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "in_app_notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "in_app_notifications_tenant_id_created_at_idx"
  ON "in_app_notifications"("tenant_id", "created_at");
CREATE INDEX "in_app_notifications_user_id_read_at_idx"
  ON "in_app_notifications"("user_id", "read_at");

ALTER TABLE "in_app_notifications"
  ADD CONSTRAINT "in_app_notifications_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "in_app_notifications"
  ADD CONSTRAINT "in_app_notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "outgoing_webhooks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "secret_encrypted" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "events_json" JSONB NOT NULL DEFAULT '["lead.created","dialog.closed"]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "outgoing_webhooks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outgoing_webhooks_tenant_id_key" ON "outgoing_webhooks"("tenant_id");

ALTER TABLE "outgoing_webhooks"
  ADD CONSTRAINT "outgoing_webhooks_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

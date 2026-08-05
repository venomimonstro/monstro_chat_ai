-- Sprint 64: Chat funnel analytics events

CREATE TYPE "ChatFunnelEventType" AS ENUM (
  'widget_open',
  'first_message',
  'contact_shared',
  'lead_created'
);

CREATE TABLE "chat_funnel_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "source_id" UUID NOT NULL,
  "dialog_id" UUID,
  "visitor_id" TEXT NOT NULL,
  "event_type" "ChatFunnelEventType" NOT NULL,
  "utm_json" JSONB NOT NULL DEFAULT '{}',
  "referrer" TEXT,
  "landing_page" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_funnel_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_funnel_events_tenant_created_idx"
  ON "chat_funnel_events"("tenant_id", "created_at");
CREATE INDEX "chat_funnel_events_tenant_type_created_idx"
  ON "chat_funnel_events"("tenant_id", "event_type", "created_at");
CREATE INDEX "chat_funnel_events_source_id_idx"
  ON "chat_funnel_events"("source_id");
CREATE UNIQUE INDEX "chat_funnel_events_dialog_type_key"
  ON "chat_funnel_events"("dialog_id", "event_type")
  WHERE "dialog_id" IS NOT NULL;

ALTER TABLE "chat_funnel_events"
  ADD CONSTRAINT "chat_funnel_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_funnel_events"
  ADD CONSTRAINT "chat_funnel_events_source_id_fkey"
  FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_funnel_events"
  ADD CONSTRAINT "chat_funnel_events_dialog_id_fkey"
  FOREIGN KEY ("dialog_id") REFERENCES "dialogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

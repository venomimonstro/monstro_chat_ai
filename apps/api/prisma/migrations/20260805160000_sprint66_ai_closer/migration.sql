-- Sprint 66: AI-closer follow-up state on dialogs
ALTER TABLE "dialogs" ADD COLUMN IF NOT EXISTS "follow_up_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "dialogs" ADD COLUMN IF NOT EXISTS "next_follow_up_at" TIMESTAMP(3);
ALTER TABLE "dialogs" ADD COLUMN IF NOT EXISTS "closer_state" TEXT;
ALTER TABLE "dialogs" ADD COLUMN IF NOT EXISTS "last_user_message_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "dialogs_next_follow_up_at_status_idx"
  ON "dialogs" ("next_follow_up_at", "status");

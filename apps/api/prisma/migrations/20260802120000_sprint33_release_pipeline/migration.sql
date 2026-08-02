-- Sprint 33: sprint number on system updates
ALTER TABLE "system_updates" ADD COLUMN IF NOT EXISTS "sprint_number" INTEGER;

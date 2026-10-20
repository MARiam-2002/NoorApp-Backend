ALTER TABLE "adhkar_reminder_preferences"
  ADD COLUMN "bedtimeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bedtimeTime" TEXT NOT NULL DEFAULT '22:00' CHECK ("bedtimeTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "adhkar_reminder_send_logs" DROP CONSTRAINT "adhkar_reminder_send_logs_kind_check";
ALTER TABLE "adhkar_reminder_send_logs" ADD CONSTRAINT "adhkar_reminder_send_logs_kind_check" CHECK ("kind" IN ('MORNING','EVENING','BEFORE_SLEEP'));
DROP INDEX "adhkar_reminder_enabled_idx";
CREATE INDEX "adhkar_reminder_enabled_idx" ON "adhkar_reminder_preferences" ("userId") WHERE "morningEnabled" OR "eveningEnabled" OR "bedtimeEnabled";

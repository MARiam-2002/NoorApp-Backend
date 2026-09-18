-- Opt-in Salawat reminders: default OFF, persist interval + active window, durable send log.
ALTER TABLE "users" ALTER COLUMN "salawatReminderEnabled" SET DEFAULT false;
UPDATE "users" SET "salawatReminderEnabled" = false;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "salawatIntervalMinutes" INTEGER NOT NULL DEFAULT 180;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "salawatWindowStart" TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "salawatWindowEnd" TEXT NOT NULL DEFAULT '22:00';

CREATE TABLE IF NOT EXISTS "salawat_send_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salawat_send_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "salawat_send_logs_userId_occurrenceKey_key"
  ON "salawat_send_logs"("userId", "occurrenceKey");

CREATE INDEX IF NOT EXISTS "salawat_send_logs_userId_createdAt_idx"
  ON "salawat_send_logs"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salawat_send_logs_userId_fkey'
  ) THEN
    ALTER TABLE "salawat_send_logs"
      ADD CONSTRAINT "salawat_send_logs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

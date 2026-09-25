-- Flexible khatmah plan + evening ward reminder

ALTER TABLE "khatmah" ADD COLUMN IF NOT EXISTS "planMode" TEXT;
ALTER TABLE "khatmah" ADD COLUMN IF NOT EXISTS "planDurationDays" INTEGER;
ALTER TABLE "khatmah" ADD COLUMN IF NOT EXISTS "planJuzPerMonth" INTEGER;
ALTER TABLE "khatmah" ADD COLUMN IF NOT EXISTS "planStartedAt" TIMESTAMP(3);
ALTER TABLE "khatmah" ADD COLUMN IF NOT EXISTS "planTargetEndAt" TIMESTAMP(3);
ALTER TABLE "khatmah" ADD COLUMN IF NOT EXISTS "planPagesAtStart" INTEGER;
ALTER TABLE "khatmah" ADD COLUMN IF NOT EXISTS "dailyWardPages" INTEGER;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "khatmahReminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "khatmahReminderTime" TEXT NOT NULL DEFAULT '21:00';

CREATE TABLE IF NOT EXISTS "khatmah_send_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "khatmah_send_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "khatmah_send_logs_userId_occurrenceKey_key"
  ON "khatmah_send_logs"("userId", "occurrenceKey");
CREATE INDEX IF NOT EXISTS "khatmah_send_logs_userId_createdAt_idx"
  ON "khatmah_send_logs"("userId", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'khatmah_send_logs_userId_fkey') THEN
    ALTER TABLE "khatmah_send_logs"
      ADD CONSTRAINT "khatmah_send_logs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'KHATMAH'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'KHATMAH';
  END IF;
END $$;

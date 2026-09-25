-- Duha + Qiyam opt-in reminders (custom event voice defaults)

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "duhaReminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "duhaReminderTime" TEXT NOT NULL DEFAULT '09:30';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "qiyamReminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "qiyamReminderTime" TEXT NOT NULL DEFAULT '02:30';

CREATE TABLE IF NOT EXISTS "duha_send_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "duha_send_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "duha_send_logs_userId_occurrenceKey_key"
  ON "duha_send_logs"("userId", "occurrenceKey");
CREATE INDEX IF NOT EXISTS "duha_send_logs_userId_createdAt_idx"
  ON "duha_send_logs"("userId", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'duha_send_logs_userId_fkey') THEN
    ALTER TABLE "duha_send_logs"
      ADD CONSTRAINT "duha_send_logs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "qiyam_send_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qiyam_send_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "qiyam_send_logs_userId_occurrenceKey_key"
  ON "qiyam_send_logs"("userId", "occurrenceKey");
CREATE INDEX IF NOT EXISTS "qiyam_send_logs_userId_createdAt_idx"
  ON "qiyam_send_logs"("userId", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qiyam_send_logs_userId_fkey') THEN
    ALTER TABLE "qiyam_send_logs"
      ADD CONSTRAINT "qiyam_send_logs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'DUHA'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'DUHA';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'QIYAM'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'QIYAM';
  END IF;
END $$;

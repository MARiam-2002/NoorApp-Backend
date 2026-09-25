-- Surah Al-Mulk bedtime reminder prefs + durable send log + NotificationType.MULK

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mulkReminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mulkReminderTime" TEXT NOT NULL DEFAULT '20:00';

CREATE TABLE IF NOT EXISTS "mulk_send_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mulk_send_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mulk_send_logs_userId_occurrenceKey_key"
  ON "mulk_send_logs"("userId", "occurrenceKey");

CREATE INDEX IF NOT EXISTS "mulk_send_logs_userId_createdAt_idx"
  ON "mulk_send_logs"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mulk_send_logs_userId_fkey'
  ) THEN
    ALTER TABLE "mulk_send_logs"
      ADD CONSTRAINT "mulk_send_logs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'NotificationType'
      AND e.enumlabel = 'MULK'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'MULK';
  END IF;
END
$$;

-- Durable idempotency for Azan / Near-Prayer FCM (mirrors salawat_send_logs).
CREATE TABLE IF NOT EXISTS "azan_reminder_send_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "azan_reminder_send_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "azan_reminder_send_logs_userId_occurrenceKey_key"
  ON "azan_reminder_send_logs"("userId", "occurrenceKey");

CREATE INDEX IF NOT EXISTS "azan_reminder_send_logs_userId_createdAt_idx"
  ON "azan_reminder_send_logs"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'azan_reminder_send_logs_userId_fkey'
  ) THEN
    ALTER TABLE "azan_reminder_send_logs"
      ADD CONSTRAINT "azan_reminder_send_logs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

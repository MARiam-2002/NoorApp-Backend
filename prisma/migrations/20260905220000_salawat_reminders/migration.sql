-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "salawatReminderEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterEnum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'NotificationType'
      AND e.enumlabel = 'SALAWAT'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'SALAWAT';
  END IF;
END
$$;

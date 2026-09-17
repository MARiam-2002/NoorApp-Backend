-- AlterTable: migrate per-session Ayah dedup from calendar-day to Flutter app-open session id.
-- 1. Add sessionId column (UUID). Use DEFAULT gen_random_uuid() for existing rows so the NOT NULL
--    constraint works even if the table has dev-seeded data from the previous migration.
--    After the column is added + populated, drop the transient DEFAULT so new inserts MUST provide it.
ALTER TABLE "user_ayah_history"
  ADD COLUMN "sessionId" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "user_ayah_history"
  ALTER COLUMN "sessionId" DROP DEFAULT;

-- 2. Drop the old (userId, displayDate) composite UNIQUE (calendar-day dedup is NO LONGER correct).
DROP INDEX IF EXISTS "user_ayah_history_userId_displayDate_key";

-- 3. Add the new (userId, sessionId) composite UNIQUE (one history row per user per app-open session).
CREATE UNIQUE INDEX IF NOT EXISTS "user_ayah_history_userId_sessionId_key"
  ON "user_ayah_history"("userId", "sessionId");

-- 4. Re-create the ordering index covering history queries: WHERE userId = ? ORDER BY createdAt DESC.
DROP INDEX IF EXISTS "user_ayah_history_userId_createdAt_idx";

CREATE INDEX IF NOT EXISTS "user_ayah_history_userId_createdAt_idx"
  ON "user_ayah_history"("userId", "createdAt" DESC);

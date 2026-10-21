ALTER TABLE "challenge_completions" ADD COLUMN "year" INTEGER NOT NULL DEFAULT EXTRACT(year FROM CURRENT_DATE)::integer;
-- Existing rows are retained. completedAt is Prisma UTC timestamp without time zone.
UPDATE "challenge_completions" AS c SET "year" = EXTRACT(year FROM ((c."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE COALESCE(t.name,'Africa/Cairo')))::integer
FROM "users" u LEFT JOIN pg_timezone_names t ON t.name = u.timezone WHERE u.id = c."userId";
DROP INDEX IF EXISTS "challenge_completions_userId_dayOfYear_key";
DROP INDEX IF EXISTS "challenge_completions_userId_dayOfYear_idx";
CREATE UNIQUE INDEX "challenge_completions_userId_year_dayOfYear_key" ON "challenge_completions"("userId", "year", "dayOfYear");
CREATE INDEX "challenge_completions_userId_year_dayOfYear_idx" ON "challenge_completions"("userId", "year", "dayOfYear");

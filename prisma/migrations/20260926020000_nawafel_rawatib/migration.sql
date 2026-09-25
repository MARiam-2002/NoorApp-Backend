-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NawafelKey') THEN
    CREATE TYPE "NawafelKey" AS ENUM (
      'FAJR_BEFORE_2',
      'DHUHR_BEFORE_4',
      'DHUHR_AFTER_2',
      'MAGHRIB_AFTER_2',
      'ISHA_AFTER_2'
    );
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "nawafel_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "key" "NawafelKey" NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nawafel_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "nawafel_completions_userId_date_key_key"
  ON "nawafel_completions"("userId", "date", "key");

CREATE INDEX IF NOT EXISTS "nawafel_completions_userId_date_idx"
  ON "nawafel_completions"("userId", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nawafel_completions_userId_fkey'
  ) THEN
    ALTER TABLE "nawafel_completions"
      ADD CONSTRAINT "nawafel_completions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

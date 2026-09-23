-- CreateEnum
-- (intentionally left blank; QuranSajdahCompletion uses no new enums)

-- CreateTable: quran_sajdah_completions — one row max per (userId, surahId, ayahNumber)
-- Tracks user "performed Sujood at-Tilawah" for each of the 15 canonical Sajdah verses.
CREATE TABLE IF NOT EXISTS "quran_sajdah_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surahId" INTEGER NOT NULL,
    "ayahNumber" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "sessionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quran_sajdah_completions_pkey" PRIMARY KEY ("id")
);

-- Unique composite key (business identity): each user × verse max 1 row
CREATE UNIQUE INDEX IF NOT EXISTS "quran_sajdah_completions_userId_surahId_ayahNumber_key"
    ON "quran_sajdah_completions"("userId", "surahId", "ayahNumber");

-- Fast lookup per user for progress / summary queries
CREATE INDEX IF NOT EXISTS "quran_sajdah_completions_userId_idx"
    ON "quran_sajdah_completions"("userId");

-- Foreign key → users.id (CASCADE delete: if user removed, wipe their sujood rows)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'quran_sajdah_completions_userId_fkey'
    ) THEN
        ALTER TABLE "quran_sajdah_completions"
        ADD CONSTRAINT "quran_sajdah_completions_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterEnum


-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.





-- DropForeignKey
ALTER TABLE "mushaf_bookmarks" DROP CONSTRAINT IF EXISTS "mushaf_bookmarks_userId_fkey";

-- DropForeignKey
ALTER TABLE "mushaf_preferences" DROP CONSTRAINT IF EXISTS "mushaf_preferences_userId_fkey";

-- DropForeignKey
ALTER TABLE "mushaf_reader_states" DROP CONSTRAINT IF EXISTS "mushaf_reader_states_userId_fkey";

-- DropForeignKey
ALTER TABLE "warsh_bookmarks" DROP CONSTRAINT IF EXISTS "warsh_bookmarks_userId_fkey";

-- DropForeignKey
ALTER TABLE "warsh_completions" DROP CONSTRAINT IF EXISTS "warsh_completions_cycleId_fkey";

-- DropForeignKey
ALTER TABLE "warsh_cycles" DROP CONSTRAINT IF EXISTS "warsh_cycles_userId_fkey";

-- DropForeignKey
ALTER TABLE "warsh_reader_states" DROP CONSTRAINT IF EXISTS "warsh_reader_states_userId_fkey";

-- AlterTable
ALTER TABLE "daily_challenge_templates" ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT,
ADD COLUMN IF NOT EXISTS "titleEn" TEXT;

-- AlterTable
ALTER TABLE "daily_dhikr_completions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "daily_progress" ADD COLUMN IF NOT EXISTS "eveningAdhkarCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "morningAdhkarCompleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "device_tokens" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "dhikr_categories" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "dhikr_items" ADD COLUMN IF NOT EXISTS "benefitEn" TEXT,
ADD COLUMN IF NOT EXISTS "textEn" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "bodyEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "deepLink" TEXT,
ADD COLUMN IF NOT EXISTS "payload" JSONB,
ADD COLUMN IF NOT EXISTS "titleEn" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "type" SET DEFAULT 'SYSTEM';

-- AlterTable
ALTER TABLE "stance_situations" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tasbih_logs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_tasbihs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT,
ADD COLUMN IF NOT EXISTS "city" TEXT,
ADD COLUMN IF NOT EXISTS "country" TEXT,
ADD COLUMN IF NOT EXISTS "googleId" TEXT,
ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "phone" TEXT,
ADD COLUMN IF NOT EXISTS "prayerCalculationMethod" TEXT NOT NULL DEFAULT 'EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY',
ADD COLUMN IF NOT EXISTS "quranAutoScrollEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "adhkar_resume_marks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "markedItemId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adhkar_resume_marks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "adhkar_resume_marks_userId_categoryKey_idx" ON "adhkar_resume_marks"("userId", "categoryKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "adhkar_resume_marks_userId_categoryKey_key" ON "adhkar_resume_marks"("userId", "categoryKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quran_bookmarks_userId_surahId_ayahNumber_idx" ON "quran_bookmarks"("userId", "surahId", "ayahNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quran_bookmarks_userId_page_idx" ON "quran_bookmarks"("userId", "page");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mushaf_reader_states_userId_fkey' AND conrelid='"mushaf_reader_states"'::regclass) THEN
  ALTER TABLE "mushaf_reader_states" ADD CONSTRAINT "mushaf_reader_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mushaf_preferences_userId_fkey' AND conrelid='"mushaf_preferences"'::regclass) THEN
  ALTER TABLE "mushaf_preferences" ADD CONSTRAINT "mushaf_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mushaf_bookmarks_userId_fkey' AND conrelid='"mushaf_bookmarks"'::regclass) THEN
  ALTER TABLE "mushaf_bookmarks" ADD CONSTRAINT "mushaf_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='warsh_reader_states_userId_fkey' AND conrelid='"warsh_reader_states"'::regclass) THEN
  ALTER TABLE "warsh_reader_states" ADD CONSTRAINT "warsh_reader_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='warsh_bookmarks_userId_fkey' AND conrelid='"warsh_bookmarks"'::regclass) THEN
  ALTER TABLE "warsh_bookmarks" ADD CONSTRAINT "warsh_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='warsh_cycles_userId_fkey' AND conrelid='"warsh_cycles"'::regclass) THEN
  ALTER TABLE "warsh_cycles" ADD CONSTRAINT "warsh_cycles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='warsh_completions_cycleId_fkey' AND conrelid='"warsh_completions"'::regclass) THEN
  ALTER TABLE "warsh_completions" ADD CONSTRAINT "warsh_completions_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "warsh_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='device_tokens_userId_fkey' AND conrelid='"device_tokens"'::regclass) THEN
  ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stance_answers_situationId_fkey' AND conrelid='"stance_answers"'::regclass) THEN
  ALTER TABLE "stance_answers" ADD CONSTRAINT "stance_answers_situationId_fkey" FOREIGN KEY ("situationId") REFERENCES "stance_situations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='adhkar_resume_marks_userId_fkey' AND conrelid='"adhkar_resume_marks"'::regclass) THEN
  ALTER TABLE "adhkar_resume_marks" ADD CONSTRAINT "adhkar_resume_marks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;


ALTER TABLE "notifications" ALTER COLUMN "bodyEn" DROP DEFAULT, ALTER COLUMN "titleEn" DROP DEFAULT;

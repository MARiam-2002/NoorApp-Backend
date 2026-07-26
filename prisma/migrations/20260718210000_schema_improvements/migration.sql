-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable: convert role string to enum
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING (
  CASE
    WHEN LOWER("role") = 'admin' THEN 'ADMIN'::"UserRole"
    ELSE 'USER'::"UserRole"
  END
);
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';

-- Drop redundant indexes (unique constraints already provide indexes)
DROP INDEX IF EXISTS "users_email_idx";
DROP INDEX IF EXISTS "refresh_tokens_tokenHash_idx";
DROP INDEX IF EXISTS "password_reset_tokens_tokenHash_idx";

-- AddForeignKey: Khatmah -> Surah
ALTER TABLE "khatmah" ADD CONSTRAINT "khatmah_currentSurahId_fkey"
  FOREIGN KEY ("currentSurahId") REFERENCES "surahs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: VerseOfTheDay -> Surah
ALTER TABLE "verses_of_the_day" ADD CONSTRAINT "verses_of_the_day_surahNumber_fkey"
  FOREIGN KEY ("surahNumber") REFERENCES "surahs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

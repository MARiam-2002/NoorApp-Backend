-- CreateEnum
CREATE TYPE "PrayerName" AS ENUM ('FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA');

-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('QURAN_PAGES', 'PRAYER', 'ADHKAR', 'SADAQAH');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo';
ALTER TABLE "users" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quranPagesRead" INTEGER NOT NULL DEFAULT 0,
    "adhkarCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sadaqahAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "prayer" "PrayerName" NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prayer_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "khatmah" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentSurahId" INTEGER NOT NULL DEFAULT 2,
    "currentPage" INTEGER NOT NULL DEFAULT 1,
    "totalPagesRead" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "khatmah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surahs" (
    "id" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "totalPages" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "surahs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verses_of_the_day" (
    "id" TEXT NOT NULL,
    "dayOfYear" INTEGER NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "ayahNumber" INTEGER NOT NULL,
    "textAr" TEXT NOT NULL,
    "referenceAr" TEXT NOT NULL,

    CONSTRAINT "verses_of_the_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hadiths_of_the_day" (
    "id" TEXT NOT NULL,
    "dayOfYear" INTEGER NOT NULL,
    "textAr" TEXT NOT NULL,
    "sourceAr" TEXT NOT NULL,

    CONSTRAINT "hadiths_of_the_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_challenge_templates" (
    "id" TEXT NOT NULL,
    "dayOfYear" INTEGER NOT NULL,
    "titleAr" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "type" "ChallengeType" NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "rewardPoints" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "daily_challenge_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfYear" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "challenge_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");
CREATE INDEX "password_reset_tokens_tokenHash_idx" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "daily_progress_userId_date_key" ON "daily_progress"("userId", "date");
CREATE INDEX "daily_progress_userId_date_idx" ON "daily_progress"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "prayer_completions_userId_date_prayer_key" ON "prayer_completions"("userId", "date", "prayer");
CREATE INDEX "prayer_completions_userId_date_idx" ON "prayer_completions"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "khatmah_userId_key" ON "khatmah"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verses_of_the_day_dayOfYear_key" ON "verses_of_the_day"("dayOfYear");
CREATE UNIQUE INDEX "hadiths_of_the_day_dayOfYear_key" ON "hadiths_of_the_day"("dayOfYear");
CREATE UNIQUE INDEX "daily_challenge_templates_dayOfYear_key" ON "daily_challenge_templates"("dayOfYear");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_completions_userId_dayOfYear_key" ON "challenge_completions"("userId", "dayOfYear");
CREATE INDEX "challenge_completions_userId_dayOfYear_idx" ON "challenge_completions"("userId", "dayOfYear");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_progress" ADD CONSTRAINT "daily_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prayer_completions" ADD CONSTRAINT "prayer_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "khatmah" ADD CONSTRAINT "khatmah_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_completions" ADD CONSTRAINT "challenge_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

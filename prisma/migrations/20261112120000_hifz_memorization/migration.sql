-- Quran memorization (hifz): one plan per user, memorized segments with spaced review, reminder de-duplication.
CREATE TABLE "hifz_plans" (
 "userId" TEXT NOT NULL PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "fromSurah" INTEGER NOT NULL CHECK ("fromSurah" BETWEEN 1 AND 114),
 "toSurah" INTEGER NOT NULL CHECK ("toSurah" BETWEEN 1 AND 114),
 "direction" TEXT NOT NULL DEFAULT 'BACKWARD' CHECK ("direction" IN ('FORWARD', 'BACKWARD')),
 "dailyNewVerses" INTEGER NOT NULL DEFAULT 5 CHECK ("dailyNewVerses" BETWEEN 1 AND 50),
 "reviewLimit" INTEGER NOT NULL DEFAULT 10 CHECK ("reviewLimit" BETWEEN 1 AND 50),
 "reciterId" TEXT,
 "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
 "reminderTime" TEXT NOT NULL DEFAULT '06:00' CHECK ("reminderTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE', 'PAUSED')),
 "revision" INTEGER NOT NULL DEFAULT 0,
 "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("fromSurah" <= "toSurah")
);
CREATE INDEX "hifz_plans_reminder_idx" ON "hifz_plans"("reminderEnabled", "status");

CREATE TABLE "hifz_segments" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "surahId" INTEGER NOT NULL CHECK ("surahId" BETWEEN 1 AND 114),
 "fromAyah" INTEGER NOT NULL CHECK ("fromAyah" >= 1),
 "toAyah" INTEGER NOT NULL,
 "memorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "memorizedDay" DATE NOT NULL,
 "stage" INTEGER NOT NULL DEFAULT 0 CHECK ("stage" BETWEEN 0 AND 10),
 "nextReviewDay" DATE NOT NULL,
 "lastReviewedAt" TIMESTAMP(3),
 "lastGrade" TEXT CHECK ("lastGrade" IS NULL OR "lastGrade" IN ('AGAIN', 'HARD', 'GOOD', 'EASY')),
 "reviewCount" INTEGER NOT NULL DEFAULT 0,
 "lapses" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("toAyah" >= "fromAyah")
);
CREATE UNIQUE INDEX "hifz_segments_userId_surahId_fromAyah_key" ON "hifz_segments"("userId", "surahId", "fromAyah");
CREATE INDEX "hifz_segments_userId_nextReviewDay_idx" ON "hifz_segments"("userId", "nextReviewDay");

CREATE TABLE "hifz_send_logs" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "occurrenceKey" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "hifz_send_logs_userId_occurrenceKey_key" ON "hifz_send_logs"("userId", "occurrenceKey");
CREATE INDEX "hifz_send_logs_userId_createdAt_idx" ON "hifz_send_logs"("userId", "createdAt");

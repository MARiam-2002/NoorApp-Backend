-- Quran station: personal playlists (surahs, verse ranges and radio stations).
CREATE TABLE "quran_playlists" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "name" TEXT NOT NULL CHECK (char_length("name") BETWEEN 1 AND 60),
 "items" JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof("items") = 'array' AND jsonb_array_length("items") <= 200),
 "revision" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "quran_playlists_userId_updatedAt_idx" ON "quran_playlists"("userId", "updatedAt");

-- Sunnah fasting and Islamic occasions: reminder preferences and de-duplication of sends.
CREATE TABLE "sunnah_fasting_preferences" (
 "userId" TEXT NOT NULL PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "types" TEXT[] NOT NULL DEFAULT ARRAY['MONDAY','THURSDAY','WHITE_DAYS','ARAFAH','TASUA','ASHURA','SIX_SHAWWAL']::TEXT[],
 "occasionsEnabled" BOOLEAN NOT NULL DEFAULT true,
 "reminderTime" TEXT NOT NULL DEFAULT '21:00' CHECK ("reminderTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 "revision" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "sunnah_fasting_preferences_enabled_idx" ON "sunnah_fasting_preferences"("enabled");

CREATE TABLE "sunnah_fasting_send_logs" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "occurrenceKey" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "sunnah_fasting_send_logs_userId_occurrenceKey_key" ON "sunnah_fasting_send_logs"("userId", "occurrenceKey");
CREATE INDEX "sunnah_fasting_send_logs_userId_createdAt_idx" ON "sunnah_fasting_send_logs"("userId", "createdAt");

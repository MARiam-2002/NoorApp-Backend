-- Fasting qada ledger. Privacy: no reason (menstruation, illness, travel...) is ever stored, only day counts.
CREATE TABLE "fasting_qada_preferences" (
 "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
 "reminderTime" TEXT NOT NULL DEFAULT '21:00' CHECK ("reminderTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 "fastingWeekdays" INTEGER[] NOT NULL DEFAULT ARRAY[1,4]::INTEGER[] CHECK ("fastingWeekdays" <@ ARRAY[0,1,2,3,4,5,6]::INTEGER[]),
 "hijriOffsetDays" INTEGER NOT NULL DEFAULT 0 CHECK ("hijriOffsetDays" BETWEEN -2 AND 2),
 "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "fasting_qada_events" (
 "id" TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "kind" TEXT NOT NULL CHECK ("kind" IN ('RAMADAN_MISSED','MADE_UP','ADJUSTMENT','FIDYA')),
 "hijriYear" INTEGER CHECK ("hijriYear" BETWEEN 1300 AND 1600),
 "ramadanDay" INTEGER CHECK ("ramadanDay" BETWEEN 1 AND 30),
 "date" DATE,
 "days" INTEGER NOT NULL CHECK ("days" <> 0 AND "days" BETWEEN -400 AND 400),
 "source" TEXT CHECK ("source" IS NULL OR "source" IN ('MANUAL','ESTIMATE')),
 "requestKey" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (
  ("kind" = 'RAMADAN_MISSED' AND "hijriYear" IS NOT NULL AND "ramadanDay" IS NOT NULL AND "date" IS NULL AND "days" = 1)
  OR ("kind" = 'MADE_UP' AND "hijriYear" IS NULL AND "ramadanDay" IS NULL AND "date" IS NOT NULL AND "days" = 1)
  OR ("kind" = 'ADJUSTMENT' AND "hijriYear" IS NOT NULL AND "ramadanDay" IS NULL AND "date" IS NULL)
  OR ("kind" = 'FIDYA' AND "hijriYear" IS NOT NULL AND "ramadanDay" IS NULL AND "date" IS NULL AND "days" > 0)
 )
);
CREATE UNIQUE INDEX "fasting_qada_ramadan_day_key" ON "fasting_qada_events"("userId","hijriYear","ramadanDay") WHERE "kind" = 'RAMADAN_MISSED';
CREATE UNIQUE INDEX "fasting_qada_made_up_date_key" ON "fasting_qada_events"("userId","date") WHERE "kind" = 'MADE_UP';
CREATE UNIQUE INDEX "fasting_qada_request_key" ON "fasting_qada_events"("userId","requestKey") WHERE "requestKey" IS NOT NULL;
CREATE INDEX "fasting_qada_events_user_idx" ON "fasting_qada_events"("userId","createdAt");
CREATE TABLE "fasting_qada_send_logs" (
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "fastDate" DATE NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'CLAIMED',
 "sent" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId","fastDate")
);
CREATE INDEX "fasting_qada_send_logs_createdAt_idx" ON "fasting_qada_send_logs"("createdAt");
CREATE INDEX "fasting_qada_reminders_enabled_idx" ON "fasting_qada_preferences"("userId") WHERE "remindersEnabled" = true;

-- Excuse mode: a neutral pause of prayer tracking. No reason is stored.
CREATE TABLE "prayer_excuse_periods" (
 "id" TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "startDate" DATE NOT NULL,
 "endDate" DATE,
 "muteReminders" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("endDate" IS NULL OR ("endDate" >= "startDate" AND "endDate" - "startDate" < 60))
);
CREATE UNIQUE INDEX "prayer_excuse_one_open_key" ON "prayer_excuse_periods"("userId") WHERE "endDate" IS NULL;
CREATE INDEX "prayer_excuse_periods_user_idx" ON "prayer_excuse_periods"("userId","startDate");

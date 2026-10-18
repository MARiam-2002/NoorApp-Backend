CREATE TABLE "fajr_alarm_preferences" (
  "userId" TEXT NOT NULL,
  "preferences" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fajr_alarm_preferences_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "fajr_alarm_preferences_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "fajr_alarm_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

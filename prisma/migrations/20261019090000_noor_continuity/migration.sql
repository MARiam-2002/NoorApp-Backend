CREATE TABLE "continuity_preferences" (
  "userId" TEXT PRIMARY KEY,
  "timezone" TEXT NOT NULL,
  "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
  "reminderMinutesBeforeMidnight" INTEGER NOT NULL DEFAULT 120 CHECK ("reminderMinutesBeforeMidnight" BETWEEN 60 AND 240),
  "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "continuity_days" (
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "sourceMask" INTEGER NOT NULL CHECK ("sourceMask" BETWEEN 1 AND 3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "date"),
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "continuity_operations" (
  "userId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "requestKey"),
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "continuity_send_logs" (
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CLAIMED',
  "sent" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "date"),
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "continuity_reminders_enabled_idx" ON "continuity_preferences" ("userId") WHERE "remindersEnabled" = true;

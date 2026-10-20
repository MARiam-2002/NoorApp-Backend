CREATE TABLE "adhkar_reminder_preferences" (
  "userId" TEXT PRIMARY KEY,
  "morningEnabled" BOOLEAN NOT NULL DEFAULT false,
  "morningTime" TEXT NOT NULL DEFAULT '07:00' CHECK ("morningTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  "eveningEnabled" BOOLEAN NOT NULL DEFAULT false,
  "eveningTime" TEXT NOT NULL DEFAULT '17:00' CHECK ("eveningTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  "soundEnabled" BOOLEAN NOT NULL DEFAULT false,
  "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "adhkar_reminder_send_logs" (
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('MORNING','EVENING')),
  "status" TEXT NOT NULL DEFAULT 'CLAIMED',
  "sent" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "date", "kind"),
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "adhkar_reminder_enabled_idx" ON "adhkar_reminder_preferences" ("userId") WHERE "morningEnabled" OR "eveningEnabled";

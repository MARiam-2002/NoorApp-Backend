CREATE TABLE "kahf_preferences" (
 "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "time" TEXT NOT NULL DEFAULT '09:00' CHECK ("time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "kahf_send_logs" (
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "occurrenceKey" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId","occurrenceKey")
);
CREATE INDEX "kahf_send_logs_createdAt_idx" ON "kahf_send_logs"("createdAt");

-- Weekly «مجلس الصلاة على النبي ﷺ» (Thursday Maghrib → Friday Maghrib, user's local time). Shared total, no ranking.
CREATE TABLE "salawat_weekly_counts" (
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "weekKey" DATE NOT NULL,
 "count" INTEGER NOT NULL DEFAULT 0 CHECK ("count" >= 0 AND "count" <= 100000),
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId", "weekKey")
);
CREATE INDEX "salawat_weekly_counts_weekKey_idx" ON "salawat_weekly_counts"("weekKey");

-- Idempotency for count batches sent by the app (retries never double-count).
CREATE TABLE "salawat_weekly_batches" (
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "batchId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId", "batchId")
);
CREATE INDEX "salawat_weekly_batches_createdAt_idx" ON "salawat_weekly_batches"("createdAt");

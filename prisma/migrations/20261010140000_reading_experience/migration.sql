CREATE TABLE "reading_plans" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "editionId" TEXT NOT NULL CHECK ("editionId" IN ('madani-hafs','indopak-hafs')),
 "contentVersion" TEXT NOT NULL, "startedOn" DATE NOT NULL, "targetEndOn" DATE NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("targetEndOn" >= "startedOn")
);
CREATE UNIQUE INDEX "reading_plans_active_key" ON "reading_plans"("userId","editionId") WHERE "active"=TRUE;
CREATE TABLE "reading_units" (
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE, "editionId" TEXT NOT NULL,
 "contentVersion" TEXT NOT NULL, "scope" TEXT NOT NULL, "unitKey" TEXT NOT NULL,
 "completedOn" DATE NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId","editionId","contentVersion","scope","unitKey")
);
CREATE INDEX "reading_units_day_idx" ON "reading_units"("userId","editionId","completedOn");
CREATE TABLE "reading_sessions" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "editionId" TEXT NOT NULL, "contentVersion" TEXT NOT NULL, "scope" TEXT NOT NULL,
 "day" DATE NOT NULL, "timezone" TEXT NOT NULL, "minutes" INTEGER NOT NULL CHECK ("minutes" IN (5,10,20)),
 "payload" JSONB NOT NULL, "confirmedUnits" JSONB NOT NULL DEFAULT '[]', "doneTasks" JSONB NOT NULL DEFAULT '[]',
 "skippedTasks" JSONB NOT NULL DEFAULT '[]',
 "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE','PAUSED','COMPLETED')),
 "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision">=0),
 "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "reading_sessions_owner_idx" ON "reading_sessions"("userId","createdAt");
CREATE TABLE "reading_operations" (
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "requestKey" TEXT NOT NULL, "fingerprint" TEXT NOT NULL, "result" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId","requestKey")
);


CREATE TABLE "warsh_reader_states" (
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "contentVersion" TEXT NOT NULL,
 "verseKey" TEXT NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId","contentVersion"),
 CHECK ("revision" > 0)
);
CREATE TABLE "warsh_bookmarks" (
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "contentVersion" TEXT NOT NULL,
 "verseKey" TEXT NOT NULL,
 "ordinal" INTEGER NOT NULL CHECK ("ordinal" BETWEEN 1 AND 6214),
 "note" TEXT NOT NULL DEFAULT '',
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId","contentVersion","verseKey")
);
CREATE INDEX "warsh_bookmarks_userId_contentVersion_ordinal_idx" ON "warsh_bookmarks"("userId","contentVersion","ordinal");
CREATE TABLE "warsh_cycles" (
 "id" TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "contentVersion" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL,
 "expectedCycleId" TEXT,
 "durationDays" INTEGER NOT NULL CHECK ("durationDays" BETWEEN 1 AND 365),
 "startedOn" DATE NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("userId","requestKey")
);
CREATE UNIQUE INDEX "warsh_cycles_one_active_per_user" ON "warsh_cycles"("userId") WHERE "active"=true;
CREATE TABLE "warsh_completions" (
 "cycleId" TEXT NOT NULL REFERENCES "warsh_cycles"("id") ON DELETE CASCADE,
 "verseKey" TEXT NOT NULL,
 "completedOn" DATE NOT NULL,
 PRIMARY KEY ("cycleId","verseKey")
);
CREATE INDEX "warsh_completions_cycleId_completedOn_idx" ON "warsh_completions"("cycleId","completedOn");

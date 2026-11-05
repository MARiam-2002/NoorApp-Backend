-- Learning hub reading progress (stories, lessons, hadith). Content itself is static in the API build.
CREATE TABLE "learning_progress" (
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "itemId" TEXT NOT NULL CHECK ("itemId" ~ '^[a-z0-9-]{1,64}$'),
 "collectionId" TEXT NOT NULL CHECK ("collectionId" ~ '^[a-z0-9-]{1,64}$'),
 "lastSectionIndex" INTEGER NOT NULL DEFAULT 0 CHECK ("lastSectionIndex" BETWEEN 0 AND 200),
 "completedAt" TIMESTAMP(3),
 "quizBestScore" INTEGER CHECK ("quizBestScore" IS NULL OR "quizBestScore" BETWEEN 0 AND 100),
 "quizTotal" INTEGER CHECK ("quizTotal" IS NULL OR "quizTotal" BETWEEN 1 AND 100),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId","itemId")
);
CREATE INDEX "learning_progress_user_updated_idx" ON "learning_progress"("userId","updatedAt" DESC);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_ayah_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surahId" INTEGER NOT NULL,
    "ayahNumber" INTEGER NOT NULL,
    "displayDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_ayah_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_ayah_history_userId_displayDate_key" ON "user_ayah_history"("userId", "displayDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_ayah_history_userId_createdAt_idx" ON "user_ayah_history"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "user_ayah_history" ADD CONSTRAINT "user_ayah_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ayah_history" ADD CONSTRAINT "user_ayah_history_surahId_ayahNumber_fkey" FOREIGN KEY ("surahId", "ayahNumber") REFERENCES "ayahs"("surahId", "ayahNumber") ON DELETE CASCADE ON UPDATE CASCADE;

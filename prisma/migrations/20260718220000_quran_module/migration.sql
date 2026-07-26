-- AlterTable: extend surahs
ALTER TABLE "surahs" ADD COLUMN "totalAyahs" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ayahs" (
    "id" TEXT NOT NULL,
    "surahId" INTEGER NOT NULL,
    "ayahNumber" INTEGER NOT NULL,
    "textAr" TEXT NOT NULL,
    "page" INTEGER,
    "juz" INTEGER,

    CONSTRAINT "ayahs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quran_bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surahId" INTEGER NOT NULL,
    "ayahNumber" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quran_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quran_last_read" (
    "userId" TEXT NOT NULL,
    "surahId" INTEGER NOT NULL,
    "ayahNumber" INTEGER NOT NULL,
    "page" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quran_last_read_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "quran_reading_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surahId" INTEGER NOT NULL,
    "ayahFrom" INTEGER NOT NULL,
    "ayahTo" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quran_reading_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ayahs_surahId_ayahNumber_key" ON "ayahs"("surahId", "ayahNumber");
CREATE INDEX "ayahs_surahId_idx" ON "ayahs"("surahId");

-- CreateIndex
CREATE UNIQUE INDEX "quran_bookmarks_userId_surahId_ayahNumber_key" ON "quran_bookmarks"("userId", "surahId", "ayahNumber");
CREATE INDEX "quran_bookmarks_userId_idx" ON "quran_bookmarks"("userId");

-- CreateIndex
CREATE INDEX "quran_reading_history_userId_readAt_idx" ON "quran_reading_history"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "ayahs" ADD CONSTRAINT "ayahs_surahId_fkey" FOREIGN KEY ("surahId") REFERENCES "surahs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quran_bookmarks" ADD CONSTRAINT "quran_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quran_bookmarks" ADD CONSTRAINT "quran_bookmarks_surahId_fkey" FOREIGN KEY ("surahId") REFERENCES "surahs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quran_last_read" ADD CONSTRAINT "quran_last_read_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quran_last_read" ADD CONSTRAINT "quran_last_read_surahId_fkey" FOREIGN KEY ("surahId") REFERENCES "surahs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quran_reading_history" ADD CONSTRAINT "quran_reading_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

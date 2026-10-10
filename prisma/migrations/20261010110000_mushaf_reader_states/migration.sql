CREATE TABLE "mushaf_reader_states" (
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "editionId" TEXT NOT NULL CHECK ("editionId" IN ('madani-hafs','indopak-hafs','warsh-nafi')),
  "page" INTEGER NOT NULL CHECK ("page" BETWEEN 1 AND 700),
  "verseKey" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId","editionId")
);
CREATE TABLE "mushaf_preferences" (
  "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "editionId" TEXT NOT NULL CHECK ("editionId" IN ('madani-hafs','indopak-hafs','warsh-nafi'))
);
CREATE TABLE "mushaf_bookmarks" (
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "editionId" TEXT NOT NULL CHECK ("editionId" IN ('madani-hafs','indopak-hafs','warsh-nafi')),
  "verseKey" TEXT NOT NULL,
  "page" INTEGER NOT NULL CHECK ("page" BETWEEN 1 AND 700),
  "note" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId","editionId","verseKey")
);

-- Personal highlights and comments on verses or single words (colour, optional comment, optional tag).
CREATE TABLE "quran_annotations" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "editionId" TEXT NOT NULL,
 "verseKey" TEXT NOT NULL CHECK ("verseKey" ~ '^[0-9]{1,3}:[0-9]{1,3}$'),
 "wordPosition" INTEGER NOT NULL DEFAULT 0 CHECK ("wordPosition" BETWEEN 0 AND 200),
 "color" TEXT CHECK ("color" IS NULL OR "color" IN ('PINK','BLUE','GREEN','YELLOW','ORANGE','RED','TEAL','GRAY','BROWN','PURPLE')),
 "comment" TEXT NOT NULL DEFAULT '' CHECK (char_length("comment") <= 5000),
 "tag" TEXT NOT NULL DEFAULT '' CHECK (char_length("tag") <= 40),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("color" IS NOT NULL OR "comment" <> '')
);
CREATE UNIQUE INDEX "quran_annotations_user_edition_verse_word_key" ON "quran_annotations"("userId", "editionId", "verseKey", "wordPosition");
CREATE INDEX "quran_annotations_userId_updatedAt_idx" ON "quran_annotations"("userId", "updatedAt");

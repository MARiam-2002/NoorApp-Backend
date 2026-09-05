-- Per-user custom tasbih list (add / remove personal dhikr phrases)
CREATE TABLE IF NOT EXISTS "user_tasbihs" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "text"      TEXT NOT NULL,
  "count"     INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_tasbihs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_tasbihs_userId_text_key"
  ON "user_tasbihs" ("userId", "text");

CREATE INDEX IF NOT EXISTS "user_tasbihs_userId_sortOrder_idx"
  ON "user_tasbihs" ("userId", "sortOrder");

ALTER TABLE "user_tasbihs"
  DROP CONSTRAINT IF EXISTS "user_tasbihs_userId_fkey";

ALTER TABLE "user_tasbihs"
  ADD CONSTRAINT "user_tasbihs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

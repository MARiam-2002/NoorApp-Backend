-- Fix Prisma schema mismatch: users.quranFontSize / quranReciter / quranTafsir / quranTranslation
-- columns exist in prisma/schema.prisma but were missing from the actual Supabase/Postgres database.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "quranFontSize"   INTEGER NOT NULL DEFAULT 28,
  ADD COLUMN IF NOT EXISTS "quranReciter"    TEXT    NOT NULL DEFAULT 'Mishary_Alafasy',
  ADD COLUMN IF NOT EXISTS "quranTafsir"     TEXT    NOT NULL DEFAULT 'Ibn_Kathir',
  ADD COLUMN IF NOT EXISTS "quranTranslation" TEXT   NOT NULL DEFAULT 'Sahih_International';

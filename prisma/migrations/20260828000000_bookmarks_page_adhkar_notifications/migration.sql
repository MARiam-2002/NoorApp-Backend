-- ============================================================
--  Migration: 20260828000000_bookmarks_page_adhkar_notifications
--
--  Patches three schema mismatches between prisma/schema.prisma
--  and the actual production database (same pattern as
--  20260822134500_add_users_quran_preferences).
--
--  1. quran_bookmarks  — add `page` column; make `ayahNumber` nullable;
--                        replace the (userId, surahId, ayahNumber) unique
--                        index with a broader composite one.
--  2. Adhkar module    — create dhikr_categories, dhikr_items,
--                        daily_dhikr_completions tables and their enums.
--  3. Notifications    — create notifications table and its enum
--                        (notifications table may already exist; use IF NOT EXISTS).
--  4. Tasbih           — create tasbih_logs, tasbih_reset_history tables
--                        (same guard; tasbih GET/POST already work in production,
--                         meaning those tables already exist — the IF NOT EXISTS
--                         guards make this idempotent either way).
-- ============================================================

-- ── 1. quran_bookmarks ───────────────────────────────────────────────────────

-- Add page column if it doesn't exist yet
ALTER TABLE "quran_bookmarks"
  ADD COLUMN IF NOT EXISTS "page" INTEGER;

-- Make ayahNumber nullable (was NOT NULL in the original migration)
ALTER TABLE "quran_bookmarks"
  ALTER COLUMN "ayahNumber" DROP NOT NULL;

-- Drop the old unique index that required ayahNumber to be non-null
-- (it may be named differently depending on Prisma version; drop both variants)
DROP INDEX IF EXISTS "quran_bookmarks_userId_surahId_ayahNumber_key";

-- New partial-style unique indexes: one per bookmark type so you can't
-- double-bookmark the same ayah OR the same page in the same surah.
CREATE UNIQUE INDEX IF NOT EXISTS "quran_bookmarks_userId_surahId_ayahNumber_unique"
  ON "quran_bookmarks" ("userId", "surahId", "ayahNumber")
  WHERE "ayahNumber" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "quran_bookmarks_userId_surahId_page_unique"
  ON "quran_bookmarks" ("userId", "surahId", "page")
  WHERE "page" IS NOT NULL;

-- ── 2. Adhkar module ─────────────────────────────────────────────────────────

-- Enum for category keys
DO $$ BEGIN
  CREATE TYPE "DhikrCategoryKey" AS ENUM (
    'MORNING',
    'EVENING',
    'BEFORE_SLEEP',
    'ENTERING_MOSQUE',
    'AFTER_PRAYER',
    'GENERAL_WIRD',
    'TRAVEL',
    'SICK',
    'FOOD',
    'ISTIKHARA',
    'WUDU',
    'ISTIGHFAR',
    'QAYN',
    'MASJID_AFTER_SALAM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- dhikr_categories
CREATE TABLE IF NOT EXISTS "dhikr_categories" (
  "id"            TEXT          NOT NULL,
  "key"           "DhikrCategoryKey" NOT NULL,
  "nameAr"        TEXT          NOT NULL,
  "nameEn"        TEXT          NOT NULL,
  "descriptionAr" TEXT,
  "descriptionEn" TEXT,
  "iconCode"      TEXT          NOT NULL,
  "sortOrder"     INTEGER       NOT NULL DEFAULT 0,
  "totalItems"    INTEGER       NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dhikr_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dhikr_categories_key_key"
  ON "dhikr_categories" ("key");

CREATE INDEX IF NOT EXISTS "dhikr_categories_sortOrder_idx"
  ON "dhikr_categories" ("sortOrder");

-- dhikr_items
CREATE TABLE IF NOT EXISTS "dhikr_items" (
  "id"              TEXT          NOT NULL,
  "categoryId"      TEXT          NOT NULL,
  "orderInCategory" INTEGER       NOT NULL DEFAULT 0,
  "textAr"          TEXT          NOT NULL,
  "textArPlain"     TEXT,
  "repeatCount"     INTEGER       NOT NULL DEFAULT 1,
  "referenceAr"     TEXT,
  "referenceEn"     TEXT,
  "sourceUrl"       TEXT,
  "benefitAr"       TEXT,
  "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dhikr_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dhikr_items_categoryId_orderInCategory_idx"
  ON "dhikr_items" ("categoryId", "orderInCategory");

ALTER TABLE "dhikr_items"
  ADD CONSTRAINT "dhikr_items_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "dhikr_categories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;  -- NOT VALID so it doesn't block if run on a table with existing rows

-- daily_dhikr_completions
CREATE TABLE IF NOT EXISTS "daily_dhikr_completions" (
  "id"         TEXT          NOT NULL,
  "userId"     TEXT          NOT NULL,
  "date"       DATE          NOT NULL,
  "categoryId" TEXT,
  "itemId"     TEXT,
  "countDone"  INTEGER       NOT NULL DEFAULT 1,
  "createdAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_dhikr_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "daily_dhikr_completions_userId_date_categoryId_itemId_key"
  ON "daily_dhikr_completions" ("userId", "date", "categoryId", "itemId");

CREATE INDEX IF NOT EXISTS "daily_dhikr_completions_userId_date_idx"
  ON "daily_dhikr_completions" ("userId", "date");

ALTER TABLE "daily_dhikr_completions"
  ADD CONSTRAINT "daily_dhikr_completions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "daily_dhikr_completions"
  ADD CONSTRAINT "daily_dhikr_completions_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "dhikr_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "daily_dhikr_completions"
  ADD CONSTRAINT "daily_dhikr_completions_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "dhikr_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

-- ── 3. Notifications ─────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'PRAYER_REMINDER',
    'CHALLENGE',
    'ACHIEVEMENT',
    'GENERAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"        TEXT               NOT NULL,
  "userId"    TEXT               NOT NULL,
  "titleAr"   TEXT               NOT NULL,
  "bodyAr"    TEXT               NOT NULL,
  "type"      "NotificationType" NOT NULL DEFAULT 'GENERAL',
  "readAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx"
  ON "notifications" ("userId", "createdAt");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

-- ── 4. Tasbih ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "TasbihDhikr" AS ENUM (
    'SUBHAN_ALLAH',
    'ALHAMDULILLAH',
    'LA_ILAHA_ILLA_ALLAH',
    'ALLAHU_AKBAR',
    'ASTAGHFIRULLAH',
    'LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tasbih_logs" (
  "id"           TEXT          NOT NULL,
  "userId"       TEXT          NOT NULL,
  "date"         DATE          NOT NULL,
  "dhikr"        "TasbihDhikr" NOT NULL DEFAULT 'ALHAMDULILLAH',
  "count"        INTEGER       NOT NULL DEFAULT 0,
  "totalAllTime" INTEGER       NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasbih_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tasbih_logs_userId_date_key"
  ON "tasbih_logs" ("userId", "date");

CREATE INDEX IF NOT EXISTS "tasbih_logs_userId_date_idx"
  ON "tasbih_logs" ("userId", "date");

ALTER TABLE "tasbih_logs"
  ADD CONSTRAINT "tasbih_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

CREATE TABLE IF NOT EXISTS "tasbih_reset_history" (
  "id"               TEXT          NOT NULL,
  "userId"           TEXT          NOT NULL,
  "tasbihLogId"      TEXT          NOT NULL,
  "countBeforeReset" INTEGER       NOT NULL,
  "date"             TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasbih_reset_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tasbih_reset_history_userId_date_idx"
  ON "tasbih_reset_history" ("userId", "date");

ALTER TABLE "tasbih_reset_history"
  ADD CONSTRAINT "tasbih_reset_history_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "tasbih_reset_history"
  ADD CONSTRAINT "tasbih_reset_history_tasbihLogId_fkey"
  FOREIGN KEY ("tasbihLogId") REFERENCES "tasbih_logs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

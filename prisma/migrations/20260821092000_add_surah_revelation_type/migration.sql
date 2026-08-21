-- ============================================================
--  Quran Surah: add revelation type (مكي / مدني)
--  UI icons: MAKKI = Kaaba icon, MADANI = Green Madinah mosque
--  Idempotent SQL: runs safely even if column/enum exist
--  from prior manual prisma db push operations.
-- ============================================================

-- 1. Create the RevelationType enum if does not exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'RevelationType'
          AND n.nspname = current_schema()
    ) THEN
        CREATE TYPE "RevelationType" AS ENUM ('MAKKI', 'MADANI');
    END IF;
END $$;

-- 2. Add column safely (start as TEXT; we'll cast after the backfill)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name   = 'surahs'
          AND column_name  = 'revelationType'
    ) THEN
        ALTER TABLE "surahs" ADD COLUMN "revelationType" TEXT;
    END IF;
END $$;

-- 3. Backfill: the 25 canonically Madani (مدنية) surahs, rest = Makki (مكية)
--    Madani list derived from UI screenshot: Kaaba=مكى, GreenMosque=مدنى
--    Surahs confirmed Madani from screenshot: 2,3,4,5,8,9
UPDATE "surahs" SET "revelationType" = 'MADANI' WHERE id IN (
  2, 3, 4, 5, 8, 9, 24, 33, 47, 48, 49,
  57, 58, 59, 60, 61, 62, 63, 64, 65, 66,
  76, 98, 99, 110
);
UPDATE "surahs" SET "revelationType" = 'MAKKI' WHERE "revelationType" IS NULL;

-- 4. Cast the column to the Postgres enum so Prisma finds type match
DO $$
BEGIN
    -- Use safe ALTER with USING cast; idempotent via info_schema check for data_type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name   = 'surahs'
          AND column_name  = 'revelationType'
          AND data_type    = 'text'
    ) THEN
        ALTER TABLE "surahs"
          ALTER COLUMN "revelationType"
          TYPE "RevelationType"
          USING "revelationType"::"RevelationType";
    END IF;
END $$;

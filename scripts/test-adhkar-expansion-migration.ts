/**
 * Checks the 2026-11-12 adhkar expansion migrations in an isolated PostgreSQL schema:
 * the enum migration adds the nine new keys, and the data migration turns a database holding the previous rows
 * (BEFORE_SLEEP 7, AFTER_PRAYER 9, ENTERING_MOSQUE 9, FOOD 3, TRAVEL 5, SICK 7) into exactly the catalog,
 * keeps existing ids, changes nothing on a second run, leaves an empty database alone, and aborts on an unexpected
 * item count. A new enum value can only be used once its transaction has committed (as between two Prisma migrations),
 * so the schema is built and the enum migration applied in a first committed transaction; the data checks run in a
 * second one that is rolled back, and the temporary schema is dropped at the end.
 *
 *   ADHKAR_TEST_DB=true npx tsx scripts/test-adhkar-expansion-migration.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma';
import { ADHKAR_CATALOG_ITEMS, type AdhkarCategoryKey } from '../src/shared/data/adhkar-catalog';
import { ADHKAR_DHIKR_CATEGORIES_FALLBACK } from '../src/shared/constants/fallbacks';

const ENUM_SQL = readFileSync('prisma/migrations/20261112100000_adhkar_new_category_keys/migration.sql', 'utf8');
const DATA_SQL = readFileSync('prisma/migrations/20261112100100_adhkar_expansion/migration.sql', 'utf8');

const PREVIOUS = { BEFORE_SLEEP: 7, AFTER_PRAYER: 9, ENTERING_MOSQUE: 9, FOOD: 3, TRAVEL: 5, SICK: 7 } as const;
const NEW_KEYS = ['WAKING_UP', 'ADHAN', 'HOME', 'TOILET', 'DISTRESS', 'FASTING', 'WEATHER', 'DAILY_SITUATIONS', 'COMPREHENSIVE_DUA'] as const;
const OLD_KEYS = ['MORNING', 'EVENING', 'BEFORE_SLEEP', 'ENTERING_MOSQUE', 'AFTER_PRAYER', 'GENERAL_WIRD', 'TRAVEL', 'SICK', 'FOOD',
  'ISTIKHARA', 'WUDU', 'ISTIGHFAR', 'QAYN', 'MASJID_AFTER_SALAM'];

async function main() {
  if (process.env.ADHKAR_TEST_DB !== 'true') {
    console.log('SKIP: set ADHKAR_TEST_DB=true to run the isolated PostgreSQL migration check.');
    return;
  }
  const rollback = new Error('ROLLBACK');
  const schema = 'adhkar_exp_' + randomUUID().replace(/-/g, '');
  try {
    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe(`CREATE TYPE "DhikrCategoryKey" AS ENUM (${OLD_KEYS.map(k => `'${k}'`).join(', ')})`);
      await tx.$executeRawUnsafe(`CREATE TABLE "dhikr_categories" ("id" TEXT PRIMARY KEY, "key" "DhikrCategoryKey" UNIQUE NOT NULL,
        "nameAr" TEXT NOT NULL, "nameEn" TEXT NOT NULL, "descriptionAr" TEXT, "descriptionEn" TEXT, "iconCode" TEXT,
        "sortOrder" INT NOT NULL DEFAULT 0, "totalItems" INT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL)`);
      await tx.$executeRawUnsafe(`CREATE TABLE "dhikr_items" ("id" TEXT PRIMARY KEY, "categoryId" TEXT NOT NULL REFERENCES "dhikr_categories"("id"), "orderInCategory" INT NOT NULL,
        "textAr" TEXT NOT NULL, "textArPlain" TEXT, "repeatCount" INT NOT NULL, "referenceAr" TEXT, "benefitAr" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL)`);

      // Enum migration: idempotent, adds exactly the new keys.
      await tx.$executeRawUnsafe(ENUM_SQL);
      await tx.$executeRawUnsafe(ENUM_SQL);
      const labels = (await tx.$queryRawUnsafe(`SELECT e.enumlabel AS l FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'DhikrCategoryKey' AND n.nspname = $1 ORDER BY e.enumsortorder`, schema)).map((r: any) => r.l);
      assert.deepEqual(labels, [...OLD_KEYS, ...NEW_KEYS]);
    }, { timeout: 60000 });

    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);

      // 1) Empty database (fresh install, seeded later from the catalog): nothing happens.
      await tx.$executeRawUnsafe(DATA_SQL);
      assert.equal(Number((await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "dhikr_categories"`))[0].n), 0);

      // 2) Database with the previous rows of the six extended categories (and one untouched category).
      const seedOld = async (key: string, count: number) => {
        await tx.$executeRawUnsafe(`INSERT INTO "dhikr_categories" ("id", "key", "nameAr", "nameEn", "totalItems", "updatedAt")
          VALUES ($1, $2::"DhikrCategoryKey", $2, $2, $3, CURRENT_TIMESTAMP)`, `cat-${key}`, key, count);
        for (const item of ADHKAR_CATALOG_ITEMS[key as AdhkarCategoryKey].slice(0, count)) {
          await tx.$executeRawUnsafe(`INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`, `old-${key}-${item.orderInCategory}`, `cat-${key}`, item.orderInCategory,
            item.textAr, item.repeatCount, item.referenceAr, item.benefitAr);
        }
      };
      for (const [key, count] of Object.entries(PREVIOUS)) await seedOld(key, count);
      await seedOld('MORNING', ADHKAR_CATALOG_ITEMS.MORNING.length);

      await tx.$executeRawUnsafe(DATA_SQL);
      const snapshot = async () => tx.$queryRawUnsafe(`SELECT c."key"::text AS key, i."id", i."orderInCategory", i."textAr", i."repeatCount", i."referenceAr", i."benefitAr"
        FROM "dhikr_items" i JOIN "dhikr_categories" c ON c."id" = i."categoryId" ORDER BY c."key"::text, i."orderInCategory"`) as Promise<any[]>;
      const rows = await snapshot();
      for (const key of [...Object.keys(PREVIOUS), 'MORNING', ...NEW_KEYS] as AdhkarCategoryKey[]) {
        const got = rows.filter(r => r.key === key);
        const want = ADHKAR_CATALOG_ITEMS[key];
        assert.equal(got.length, want.length, `${key} count`);
        got.forEach((r, i) => {
          const w = want[i]!;
          assert.equal(r.orderInCategory, w.orderInCategory, `${key} #${i + 1} order`);
          assert.equal(r.textAr, w.textAr, `${key} #${i + 1} text`);
          assert.equal(r.repeatCount, w.repeatCount, `${key} #${i + 1} count`);
          assert.equal(r.referenceAr, w.referenceAr, `${key} #${i + 1} reference`);
          assert.equal(r.benefitAr, w.benefitAr, `${key} #${i + 1} benefit`);
        });
        const previous = (PREVIOUS as Record<string, number>)[key] ?? (key === 'MORNING' ? want.length : 0);
        for (let i = 0; i < previous; i += 1) assert.equal(got[i].id, `old-${key}-${i + 1}`, 'existing rows keep their ids');
        const total = await tx.$queryRawUnsafe(`SELECT "totalItems" FROM "dhikr_categories" WHERE "key"::text = $1`, key);
        assert.equal(total[0].totalItems, want.length, `${key} totalItems`);
      }
      // New category metadata equals the API fallback (which mirrors the seed).
      const cats = await tx.$queryRawUnsafe(`SELECT "key"::text AS key, "nameAr", "nameEn", "descriptionAr", "descriptionEn", "iconCode", "sortOrder"
        FROM "dhikr_categories" WHERE "key"::text = ANY($1::text[]) ORDER BY "sortOrder"`, NEW_KEYS as unknown as string[]);
      assert.equal(cats.length, NEW_KEYS.length);
      for (const c of cats) {
        const f = (ADHKAR_DHIKR_CATEGORIES_FALLBACK as readonly any[]).find(x => x.key === c.key);
        assert.ok(f, `${c.key} in fallback`);
        for (const field of ['nameAr', 'nameEn', 'descriptionAr', 'descriptionEn', 'iconCode', 'sortOrder']) assert.equal(c[field], f[field], `${c.key}.${field}`);
      }

      // 3) Second run: no change.
      await tx.$executeRawUnsafe(DATA_SQL);
      assert.deepEqual(await snapshot(), rows);

      // 4) Unexpected states abort instead of guessing.
      await tx.$executeRawUnsafe(`SAVEPOINT s1`);
      await tx.$executeRawUnsafe(`DELETE FROM "dhikr_items" WHERE "categoryId" = 'cat-FOOD' AND "orderInCategory" = 7`);
      await assert.rejects(tx.$executeRawUnsafe(DATA_SQL), /expected 3 or 7 items in FOOD/);
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT s1`);
      await tx.$executeRawUnsafe(`DELETE FROM "dhikr_items" WHERE "categoryId" = (SELECT "id" FROM "dhikr_categories" WHERE "key" = 'WEATHER') AND "orderInCategory" = 4`);
      await assert.rejects(tx.$executeRawUnsafe(DATA_SQL), /expected 0 or 4 items in WEATHER/);
      console.log('Adhkar expansion migration checks passed: enum keys added, empty DB untouched, 6 categories extended and 9 created equal to the catalog, ids kept, idempotent, unexpected state aborts. Rolled back.');
      throw rollback;
    }, { timeout: 60000 });
  } catch (e) {
    if (e !== rollback) throw e;
  } finally {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
    await prisma.$disconnect();
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

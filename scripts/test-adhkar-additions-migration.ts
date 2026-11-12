/**
 * Checks the 2026-11-12 morning/evening additions migration in an isolated PostgreSQL schema:
 * a database holding the previous reviewed rows (12 morning, 11 evening) ends up exactly equal to the catalog,
 * existing rows keep their ids, a second run changes nothing, an empty database is left alone, and an unexpected
 * item count aborts. All changes are rolled back.
 *
 *   ADHKAR_TEST_DB=true npx tsx scripts/test-adhkar-additions-migration.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma';
import { ADHKAR_CATALOG_ITEMS } from '../src/shared/data/adhkar-catalog';

const SQL = readFileSync('prisma/migrations/20261112090000_adhkar_morning_evening_additions/migration.sql', 'utf8');

// Previous positions (old order → new order) and the two references the migration rewrites.
const MOVED = {
  MORNING: { 1: 1, 2: 2, 3: 3, 4: 5, 5: 10, 6: 11, 12: 12, 8: 15, 7: 17, 10: 18, 9: 19, 11: 20 },
  EVENING: { 1: 1, 2: 2, 4: 4, 3: 6, 5: 12, 6: 13, 8: 15, 7: 16, 10: 17, 9: 18, 11: 19 },
} as const;
const OLD_REF = { MORNING: { 10: 'رواه أبو داود - أربع مرات', 11: 'رواه أبو داود' }, EVENING: { 12: 'رواه أبو داود - أربع مرات', 13: 'رواه أبو داود' } } as const;

async function main() {
  if (process.env.ADHKAR_TEST_DB !== 'true') {
    console.log('SKIP: set ADHKAR_TEST_DB=true to run the isolated PostgreSQL migration check.');
    return;
  }
  const rollback = new Error('ROLLBACK');
  const schema = 'adhkar_mig_' + randomUUID().replace(/-/g, '');
  try {
    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe(`CREATE TABLE "dhikr_categories" ("id" TEXT PRIMARY KEY, "key" TEXT UNIQUE NOT NULL, "totalItems" INT NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await tx.$executeRawUnsafe(`CREATE TABLE "dhikr_items" ("id" TEXT PRIMARY KEY, "categoryId" TEXT NOT NULL REFERENCES "dhikr_categories"("id"), "orderInCategory" INT NOT NULL,
        "textAr" TEXT NOT NULL, "textArPlain" TEXT, "repeatCount" INT NOT NULL, "referenceAr" TEXT, "benefitAr" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);

      // 1) Empty database (fresh install): nothing happens.
      await tx.$executeRawUnsafe(SQL);
      assert.equal(Number((await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "dhikr_items"`))[0].n), 0);

      // 2) Database with the previous reviewed rows.
      for (const key of ['MORNING', 'EVENING'] as const) {
        await tx.$executeRawUnsafe(`INSERT INTO "dhikr_categories" ("id", "key", "totalItems") VALUES ($1, $2, $3)`, `cat-${key}`, key, Object.keys(MOVED[key]).length);
        for (const [oldOrder, newOrder] of Object.entries(MOVED[key])) {
          const item = ADHKAR_CATALOG_ITEMS[key][newOrder - 1]!;
          const ref = (OLD_REF[key] as Record<number, string>)[newOrder] ?? item.referenceAr;
          await tx.$executeRawUnsafe(`INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            `old-${key}-${oldOrder}`, `cat-${key}`, Number(oldOrder), item.textAr, item.repeatCount, ref, item.benefitAr);
        }
      }
      await tx.$executeRawUnsafe(SQL);
      const snapshot = async () => tx.$queryRawUnsafe(`SELECT c."key", i."id", i."orderInCategory", i."textAr", i."repeatCount", i."referenceAr", i."benefitAr"
        FROM "dhikr_items" i JOIN "dhikr_categories" c ON c."id" = i."categoryId" ORDER BY c."key", i."orderInCategory"`) as Promise<any[]>;
      const rows = await snapshot();
      for (const key of ['MORNING', 'EVENING'] as const) {
        const got = rows.filter(r => r.key === key);
        const want = ADHKAR_CATALOG_ITEMS[key];
        assert.equal(got.length, want.length, `${key} count`);
        got.forEach((r, i) => {
          const w = want[i]!;
          assert.equal(r.orderInCategory, w.orderInCategory);
          assert.equal(r.textAr, w.textAr, `${key} #${i + 1} text`);
          assert.equal(r.repeatCount, w.repeatCount, `${key} #${i + 1} count`);
          assert.equal(r.referenceAr, w.referenceAr, `${key} #${i + 1} reference`);
          assert.equal(r.benefitAr, w.benefitAr, `${key} #${i + 1} benefit`);
        });
        for (const [oldOrder, newOrder] of Object.entries(MOVED[key])) assert.equal(got[newOrder - 1].id, `old-${key}-${oldOrder}`, 'existing rows keep their ids');
        const total = await tx.$queryRawUnsafe(`SELECT "totalItems" FROM "dhikr_categories" WHERE "key" = $1`, key);
        assert.equal(total[0].totalItems, want.length);
      }

      // 3) Second run: no change.
      await tx.$executeRawUnsafe(SQL);
      assert.deepEqual(await snapshot(), rows);

      // 4) Unexpected state aborts instead of guessing.
      await tx.$executeRawUnsafe(`DELETE FROM "dhikr_items" WHERE "categoryId" = 'cat-EVENING' AND "orderInCategory" = 19`);
      await assert.rejects(tx.$executeRawUnsafe(SQL), /expected 12 morning and 11 evening/);
      console.log('Adhkar additions migration checks passed: empty DB untouched, 12/11 → 20/19 equal to the catalog, ids kept, idempotent, unexpected state aborts. Rolled back.');
      throw rollback;
    }, { timeout: 60000 });
  } catch (e) {
    if (e !== rollback) throw e;
  } finally {
    await prisma.$disconnect();
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

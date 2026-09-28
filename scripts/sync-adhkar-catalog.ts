/**
 * Updates production adhkar rows in place (same ids) to match src/shared/data/adhkar-catalog.ts.
 * Only for wording/reference/count edits: aborts if any category's item count differs from the catalog.
 *
 *   npx tsx scripts/sync-adhkar-catalog.ts            # dry run (read-only)
 *   npx tsx scripts/sync-adhkar-catalog.ts --apply    # write
 *
 * After changing the catalog, bump ADHKAR_STATIC_CATALOG_VERSION so Flutter re-downloads it.
 */
import { PrismaClient } from '@prisma/client';
import { ADHKAR_CATALOG_ITEMS, type AdhkarCategoryKey } from '../src/shared/data/adhkar-catalog';

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

const FIELDS = ['textAr', 'repeatCount', 'referenceAr', 'benefitAr'] as const;

async function main(): Promise<void> {
  const categories = await prisma.dhikrCategory.findMany({
    include: { items: { orderBy: [{ orderInCategory: 'asc' }, { createdAt: 'asc' }] } },
  });

  const updates: { id: string; label: string; data: Record<string, unknown> }[] = [];
  for (const key of Object.keys(ADHKAR_CATALOG_ITEMS) as AdhkarCategoryKey[]) {
    const catalog = ADHKAR_CATALOG_ITEMS[key];
    const rows = categories.find((c) => c.key === key)?.items;
    if (!rows) throw new Error(`Category missing in DB: ${key}`);
    if (rows.length !== catalog.length) {
      throw new Error(`${key}: DB has ${rows.length} items, catalog has ${catalog.length}; adding/removing items needs a reviewed migration script.`);
    }
    rows.forEach((row, index) => {
      const target = catalog[index];
      const data: Record<string, unknown> = {};
      for (const field of FIELDS) {
        if ((row[field] ?? null) !== (target[field] ?? null)) data[field] = target[field] ?? null;
      }
      if (row.orderInCategory !== target.orderInCategory) data.orderInCategory = target.orderInCategory;
      if ('textAr' in data) data.textArPlain = null;
      if (Object.keys(data).length > 0) updates.push({ id: row.id, label: `${key} #${target.orderInCategory}`, data });
    });
  }

  for (const u of updates) console.log(`${u.label}: ${Object.keys(u.data).join(', ')}`);
  console.log(`${updates.length} item(s) differ from the catalog.`);
  if (updates.length === 0 || !APPLY) {
    if (updates.length > 0) console.log('Dry run only. Re-run with --apply to write.');
    return;
  }

  await prisma.$transaction(updates.map((u) => prisma.dhikrItem.update({ where: { id: u.id }, data: u.data })));
  console.log(`Updated ${updates.length} item(s) in place.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

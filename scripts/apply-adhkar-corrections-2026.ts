/**
 * Brings production adhkar rows to the reviewed catalog (src/shared/data/adhkar-catalog.ts) without
 * changing surviving item ids, so user favorites and progress keep working.
 *
 *   npx tsx scripts/apply-adhkar-corrections-2026.ts            # dry run (read-only)
 *   npx tsx scripts/apply-adhkar-corrections-2026.ts --apply    # write, after a JSON backup in tmp/
 *
 * Removed items: favorites cascade away, completions keep history with itemId = null, and resume marks
 * pointing at them move to the next surviving item of the same category.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ADHKAR_CATALOG_ITEMS, type AdhkarCategoryKey } from '../src/shared/data/adhkar-catalog';
import { applyCategoryCorrections, planCategoryCorrections } from './lib/adhkar-corrections-2026';

const APPLY = process.argv.includes('--apply');
const BEFORE_SLEEP_DESCRIPTION_TYPO = 'أذكار وأدعية الوِرِ النوم من السنة النبوية الصحيحة';
const BEFORE_SLEEP_DESCRIPTION = 'أذكار وأدعية النوم من السنة النبوية الصحيحة';

const prisma = new PrismaClient();

type DbItem = {
  id: string;
  orderInCategory: number;
  textAr: string;
  repeatCount: number;
  referenceAr: string | null;
  benefitAr: string | null;
};

function contentKey(items: readonly Omit<DbItem, 'id'>[]): string {
  return JSON.stringify(
    items.map((i) => [i.orderInCategory, i.textAr, i.repeatCount, i.referenceAr ?? null, i.benefitAr ?? null]),
  );
}

async function loadCategories() {
  return prisma.dhikrCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        orderBy: [{ orderInCategory: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, orderInCategory: true, textAr: true, repeatCount: true, referenceAr: true, benefitAr: true },
      },
    },
  });
}

async function main(): Promise<void> {
  const categories = await loadCategories();
  const catalogKeys = Object.keys(ADHKAR_CATALOG_ITEMS) as AdhkarCategoryKey[];
  const missing = catalogKeys.filter((k) => !categories.some((c) => c.key === k));
  if (missing.length > 0) throw new Error(`Categories missing in DB: ${missing.join(', ')}`);

  const alreadyApplied = catalogKeys.every((key) => {
    const cat = categories.find((c) => c.key === key)!;
    return contentKey(cat.items) === contentKey(ADHKAR_CATALOG_ITEMS[key]);
  });
  if (alreadyApplied) {
    console.log('Adhkar rows already match the reviewed catalog — nothing to do.');
    return;
  }

  const plans = catalogKeys.map((key) => {
    const cat = categories.find((c) => c.key === key)!;
    const outcomes = planCategoryCorrections(key, cat.items);
    const expected = applyCategoryCorrections(key, cat.items);
    if (contentKey(expected) !== contentKey(ADHKAR_CATALOG_ITEMS[key])) {
      throw new Error(`${key}: corrected DB rows would differ from the reviewed catalog — aborting.`);
    }
    return { key, cat, outcomes, expected };
  });

  const removedIds = plans.flatMap((p) => p.outcomes.filter((o) => o.kind === 'remove').map((o) => o.item.id));
  const [favorites, completions, resumeMarks] = await Promise.all([
    prisma.adhkarFavorite.findMany({ where: { itemId: { in: removedIds } } }),
    prisma.dailyDhikrCompletion.findMany({ where: { itemId: { in: removedIds } } }),
    prisma.adhkarResumeMark.findMany({ where: { markedItemId: { in: removedIds } } }),
  ]);

  for (const p of plans) {
    const removed = p.outcomes.filter((o) => o.kind === 'remove').length;
    const patched = p.outcomes.filter((o) => o.kind === 'patch').length;
    console.log(`${p.key.padEnd(20)} ${String(p.cat.items.length).padStart(3)} -> ${String(p.expected.length).padStart(3)}  (patch ${patched}, remove ${removed})`);
  }
  console.log(`Removed items: ${removedIds.length}; favorites dropped: ${favorites.length}; completions detached: ${completions.length}; resume marks moved: ${resumeMarks.length}`);

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to write.');
    return;
  }

  const backupDir = join(process.cwd(), 'tmp');
  mkdirSync(backupDir, { recursive: true });
  const backupPath = join(backupDir, `adhkar-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify({ createdAt: new Date().toISOString(), categories, favorites, completions, resumeMarks }, null, 2),
    'utf8',
  );
  console.log(`Backup written: ${backupPath}`);

  for (const p of plans) {
    const survivors = p.outcomes.filter((o) => o.kind !== 'remove');
    const nextSurvivorId = (legacyOrder: number): string | null =>
      (survivors.find((o) => o.item.orderInCategory > legacyOrder) ?? survivors[0])?.item.id ?? null;

    await prisma.$transaction(
      async (tx) => {
        for (const [index, outcome] of survivors.entries()) {
          const target = p.expected[index];
          await tx.dhikrItem.update({
            where: { id: outcome.item.id },
            data: {
              orderInCategory: target.orderInCategory,
              textAr: target.textAr,
              ...(target.textAr !== outcome.item.textAr ? { textArPlain: null } : {}),
              repeatCount: target.repeatCount,
              referenceAr: target.referenceAr ?? null,
              benefitAr: target.benefitAr ?? null,
            },
          });
        }
        for (const outcome of p.outcomes) {
          if (outcome.kind !== 'remove') continue;
          const replacement = nextSurvivorId(outcome.item.orderInCategory);
          if (replacement) {
            await tx.adhkarResumeMark.updateMany({
              where: { markedItemId: outcome.item.id },
              data: { markedItemId: replacement },
            });
          }
          await tx.dhikrItem.delete({ where: { id: outcome.item.id } });
        }
        await tx.dhikrCategory.update({
          where: { id: p.cat.id },
          data: {
            totalItems: p.expected.length,
            ...(p.cat.descriptionAr === BEFORE_SLEEP_DESCRIPTION_TYPO ? { descriptionAr: BEFORE_SLEEP_DESCRIPTION } : {}),
          },
        });
      },
      { timeout: 60_000 },
    );
    console.log(`Applied ${p.key}`);
  }

  const after = await loadCategories();
  const mismatched = catalogKeys.filter((key) => {
    const cat = after.find((c) => c.key === key)!;
    return contentKey(cat.items) !== contentKey(ADHKAR_CATALOG_ITEMS[key]) || cat.totalItems !== cat.items.length;
  });
  if (mismatched.length > 0) throw new Error(`Post-apply verification failed for: ${mismatched.join(', ')}`);
  const total = after.reduce((s, c) => s + c.items.length, 0);
  console.log(`Verified: ${after.length} categories, ${total} items match the reviewed catalog.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * Sync DailyChallengeTemplate rows (day 1..366) from src/shared/data/daily-challenges.ts.
 * Rows are updated in place by dayOfYear (ids kept); ChallengeCompletion is keyed by
 * userId + dayOfYear, so user progress and claimed points are untouched. Safe to re-run.
 *
 * Usage: npx tsx scripts/sync-daily-challenges.ts            (dry run: prints the diff count)
 *        npx tsx scripts/sync-daily-challenges.ts --apply    (writes)
 */
import { PrismaClient } from '@prisma/client';
import { buildDailyChallengeTemplates, type DailyChallengeTemplateRow } from '../src/shared/data/daily-challenges';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const FIELDS = ['type', 'titleAr', 'titleEn', 'descriptionAr', 'descriptionEn', 'targetValue', 'rewardPoints'] as const;

async function main() {
  const wanted = buildDailyChallengeTemplates();
  const existing = new Map(
    (await prisma.dailyChallengeTemplate.findMany()).map((r) => [r.dayOfYear, r]),
  );

  const changes: DailyChallengeTemplateRow[] = [];
  const fieldCounts: Record<string, number> = {};
  for (const row of wanted) {
    const cur = existing.get(row.dayOfYear);
    const diff = cur ? FIELDS.filter((f) => cur[f] !== row[f]) : [...FIELDS];
    if (diff.length) {
      changes.push(row);
      for (const f of diff) fieldCounts[f] = (fieldCounts[f] ?? 0) + 1;
    }
  }

  console.log(`rows in DB: ${existing.size}, rows to create/update: ${changes.length}`);
  console.log('changed fields:', fieldCounts);
  if (!apply) {
    console.log('Dry run — re-run with --apply to write.');
    return;
  }

  for (const [i, row] of changes.entries()) {
    const { dayOfYear, ...data } = row;
    await prisma.dailyChallengeTemplate.upsert({
      where: { dayOfYear },
      create: row,
      update: data,
    });
    if ((i + 1) % 50 === 0) console.log(`synced ${i + 1}/${changes.length}`);
  }
  console.log(`Done — ${changes.length} rows written.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

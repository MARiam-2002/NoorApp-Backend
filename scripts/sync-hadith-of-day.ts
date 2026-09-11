/**
 * Sync HadithOfTheDay rows (day 1..366) from the verified Sahihayn bank
 * for the current calendar year. Safe to re-run.
 *
 * Usage: npx tsx scripts/sync-hadith-of-day.ts
 */
import { PrismaClient } from '@prisma/client';
import { getCuratedHadithForDay, getHadithBankStats } from '../src/shared/constants/curated-hadiths';

const prisma = new PrismaClient();

async function main() {
  const year = new Date().getFullYear();
  const stats = getHadithBankStats();
  console.log('Bank stats', stats, 'year', year);

  for (let day = 1; day <= 366; day += 1) {
    const h = getCuratedHadithForDay(day, year);
    await prisma.hadithOfTheDay.upsert({
      where: { dayOfYear: day },
      create: { dayOfYear: day, textAr: h.textAr, sourceAr: h.sourceAr },
      update: { textAr: h.textAr, sourceAr: h.sourceAr },
    });
    if (day % 50 === 0) console.log('synced through day', day);
  }

  const d1 = getCuratedHadithForDay(1, year);
  const d2 = getCuratedHadithForDay(2, year);
  console.log('day1 source:', d1.sourceAr);
  console.log('day2 source:', d2.sourceAr);
  console.log('day1!==day2 text:', d1.textAr !== d2.textAr);
  console.log('Done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

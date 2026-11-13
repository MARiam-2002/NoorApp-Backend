/**
 * Quran search ignores the basmala stored at the start of each surah's first ayah (the reader never shows it there),
 * but still finds it where it is Quran text: al-Fatiha 1 and an-Naml 30. Uses the seeded test database.
 *
 *   QURAN_SEARCH_TEST_DB=true npx tsx scripts/test-quran-search-basmala.ts
 */
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { searchQuran } from '../src/services/quran.service';

if (process.env.QURAN_SEARCH_TEST_DB !== 'true') {
  console.log('SKIP quran search basmala test (set QURAN_SEARCH_TEST_DB=true with a seeded test database)');
  process.exit(0);
}

const keys = (r: Awaited<ReturnType<typeof searchQuran>>) =>
  ((r as any).results ?? (r as any).ayahs ?? []).map((a: any) => `${a.surahId}:${a.ayahNumber}`);

async function main() {
  // The stored first ayah of al-Baqarah starts with the basmala; the search must not see it.
  const stored = await prisma.ayah.findFirst({ where: { surahId: 2, ayahNumber: 1 }, select: { textAr: true } });
  assert.ok(stored, 'seeded ayahs present');

  const rahman = await searchQuran('رحمن', 1, 100);
  const k = keys(rahman);
  assert.ok(k.includes('1:1') && k.includes('1:3') && k.includes('2:163'), `expected matches: ${k.slice(0, 10)}`);
  for (const first of ['2:1', '3:1', '4:1', '5:1', '112:1']) assert.ok(!k.includes(first), `${first} must not match «رحمن»`);
  assert.equal((rahman as any).total, k.length < 100 ? k.length : (rahman as any).total, 'count uses the same rule');

  const basmala = keys(await searchQuran('بسم الله الرحمن الرحيم', 1, 100));
  assert.deepEqual(basmala.sort(), ['1:1', '27:30'], `basmala is Quran text only in al-Fatiha 1 and an-Naml 30: ${basmala}`);

  // First ayat are still found by their own words.
  const alm = keys(await searchQuran('الم', 1, 100));
  assert.ok(alm.includes('2:1') && alm.includes('3:1'));
  assert.ok(keys(await searchQuran('قل هو الله احد', 1, 10)).includes('112:1'));

  console.log(`quran search basmala tests: ALL PASSED («رحمن» → ${k.length} ayat, basmala → 1:1 and 27:30 only)`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

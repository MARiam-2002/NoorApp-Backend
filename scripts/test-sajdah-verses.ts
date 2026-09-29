/**
 * Offline checks for the Ayat as-Sajdah catalog (no DB, no network).
 * Run: npx tsx scripts/test-sajdah-verses.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  SAJDAH_VERSES_CATALOG,
  SAJDAH_VERSE_COUNT_FULL,
  SAJDAH_VERSE_COUNT_MUATAQIDAH,
} from '../src/shared/constants/sajdah-verses';
import { loadTanzilAyah, tanzilSajdaKeys } from './build-sajdah-verses';

const quran = JSON.parse(readFileSync(path.resolve(__dirname, '../prisma/data/quran-uthmani.json'), 'utf8'));

assert.equal(SAJDAH_VERSE_COUNT_FULL, 15);
assert.equal(SAJDAH_VERSE_COUNT_MUATAQIDAH, 10);
assert.deepEqual(
  SAJDAH_VERSES_CATALOG.map((v) => `${v.surahId}:${v.ayahNumber}`),
  tanzilSajdaKeys(quran),
  'catalog must equal the Mushaf sajda marks, in Mushaf order',
);

const AGREED = ['7:206', '13:15', '16:50', '17:109', '19:58', '22:18', '25:60', '27:26', '32:15', '41:38'];
assert.deepEqual(
  SAJDAH_VERSES_CATALOG.filter((v) => v.isIn10Muataqidah).map((v) => `${v.surahId}:${v.ayahNumber}`),
  AGREED,
);

SAJDAH_VERSES_CATALOG.forEach((v, i) => {
  const key = `${v.surahId}:${v.ayahNumber}`;
  assert.equal(v.textAr, loadTanzilAyah(quran, v.surahId, v.ayahNumber), `${key} textAr must be verbatim Tanzil`);
  assert.ok(v.textAr.includes('۩'), `${key} must carry the sajdah mark`);
  assert.equal(v.sortOrder, i + 1);
  assert.match(v.referenceAr, new RegExp(`^سورة .+ - آية ${v.ayahNumber}$`));
  assert.match(v.referenceEn, new RegExp(`^Surah .+ — Verse ${v.ayahNumber}$`));
  assert.ok(v.textEn.length > 10 && !/unavailable/i.test(v.textEn), `${key} textEn`);
  if (!v.isIn10Muataqidah) assert.ok(v.noteAr && v.noteEn, `${key} disputed verse needs a madhhab note`);
  if (v.noteAr) assert.ok(v.noteEn, `${key} noteEn missing`);
});

for (const removed of ['16:49', '4:102']) {
  assert.ok(!SAJDAH_VERSES_CATALOG.some((v) => `${v.surahId}:${v.ayahNumber}` === removed), `${removed} is not a sajdah verse`);
}

console.log('test-sajdah-verses: OK (15 verses verbatim from Tanzil, 10 agreed)');

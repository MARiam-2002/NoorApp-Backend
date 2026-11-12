/**
 * Verse insights: data integrity of word meanings, verified causes of revelation and virtues (virtue wording re-checked
 * verbatim against the pinned al-Bukhari / Muslim editions), lookups and routes. No network.
 *
 *   npx tsx scripts/test-quran-insights.ts
 */
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { ASBAB_AL_NUZUL } from '../src/shared/data/quran-asbab-al-nuzul';
import { GHARIB_SIRAJ } from '../src/shared/data/quran-gharib-siraj';
import { SURAH_VIRTUES } from '../src/shared/data/quran-surah-virtues';
import { getAyahInsights, getSurahInsightMarkers, getSurahVirtues } from '../src/services/quran-insights.service';
import { quranInsightsRouter } from '../src/routes/quran-insights';
import { CATALOG_SURAHS } from '../src/data/surahs';
import { findSahihPhrase } from './lib/sahihayn-lookup';

const total = (s: number) => CATALOG_SURAHS.find(x => x.id === s)!.totalAyahs;

// Causes of revelation: only the author's accepted verdicts, valid ranges, conclusion always present.
assert.equal(ASBAB_AL_NUZUL.length, 123);
for (const e of ASBAB_AL_NUZUL) {
  assert.ok(['AUTHENTIC', 'SUPPORTED'].includes(e.verdict));
  assert.ok(e.fromAyah >= 1 && e.toAyah >= e.fromAyah && e.toAyah <= total(e.surah), `${e.surah}:${e.fromAyah}-${e.toAyah}`);
  assert.ok(e.narrations.length > 20 && e.conclusion.length > 20);
  assert.ok(!/ليس(?:ت)?\s+(?:هو\s+)?سبب|لا\s+يصح|لم\s+تنزل/.test(e.conclusion), `rejected verdict leaked: ${e.surah}:${e.fromAyah}`);
  assert.ok(!/<[a-z]|&quot;|&amp;/.test(e.narrations + e.conclusion), 'no markup');
}
assert.equal(ASBAB_AL_NUZUL.filter(e => e.verdict === 'AUTHENTIC').length, 83);

// Word meanings: one book, unique verses, non-empty.
assert.equal(GHARIB_SIRAJ.length, 3644);
assert.equal(new Set(GHARIB_SIRAJ.map(r => `${r[0]}:${r[1]}`)).size, GHARIB_SIRAJ.length);
for (const [s, a, words] of GHARIB_SIRAJ) {
  assert.ok(a >= 1 && a <= total(s));
  assert.ok(words.length > 0 && words.every(([t, m]) => t.trim() && m.trim()));
}

// Virtues: verbatim against the pinned Sahih editions.
for (const v of SURAH_VIRTUES) {
  const m = v.referenceAr.match(/^رواه (البخاري|مسلم) \((\d+)\)$/);
  if (m) assert.ok(findSahihPhrase(m[1] === 'البخاري' ? 'bukhari' : 'muslim', v.textAr).some(x => x.number === Number(m[2])), `${v.id} verbatim`);
  else assert.match(v.referenceAr, /حسنه الألباني/);
  for (const s of v.surahs) assert.ok(s >= 1 && s <= 114);
}

// Lookups.
const kursi = getAyahInsights(2, 255);
assert.equal(kursi.virtues[0]!.id, 'kursi');
const maqam = getAyahInsights(2, 125);
assert.equal(maqam.asbab.items.length, 1);
assert.equal(maqam.asbab.items[0]!.verdict, 'AUTHENTIC');
assert.ok(maqam.asbab.items[0]!.reference.includes('المحرر'));
assert.equal(getAyahInsights(2, 187).asbab.items.length, 2, 'two studies on one verse');
assert.equal(getAyahInsights(24, 15).asbab.items.length, 1, 'inside a multi-verse range (al-ifk 24:11-20)');
assert.equal(getAyahInsights(97, 1).asbab.items.length, 0, 'rejected cause of al-Qadr is not shown');
assert.ok(getAyahInsights(1, 1).meanings.words.length > 0);
assert.throws(() => getAyahInsights(1, 8), (e: any) => e.statusCode === 400);
assert.deepEqual(getSurahVirtues(112).virtues.map(v => v.id), ['ikhlas']);
assert.deepEqual(getSurahVirtues(2).virtues.map(v => v.id), ['baqarah_house', 'zahrawan', 'kursi', 'baqarah_end']);
assert.deepEqual(getSurahInsightMarkers(18).virtueAyahs, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

async function routes() {
  const app = express();
  app.use('/quran', quranInsightsRouter);
  app.use(((error: any, _req: any, res: any, _next: any) => { res.status(error.statusCode ?? (error.name === 'ZodError' ? 400 : 500)).json({ success: false }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/quran`;
    const ok = await fetch(`${base}/insights?surahId=2&ayahNumber=255`);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'public, max-age=86400');
    assert.equal(((await ok.json()) as any).data.virtues[0].id, 'kursi');
    for (const bad of ['insights?surahId=0&ayahNumber=1', 'insights?surahId=1&ayahNumber=8', 'insights?surahId=1', 'surahs/115/virtues']) {
      assert.equal((await fetch(`${base}/${bad}`)).status, 400, bad);
    }
    assert.equal((await fetch(`${base}/surahs/67/virtues`)).status, 200);
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}
routes().then(() => {
  console.log(`quran insights tests: ALL PASSED (${ASBAB_AL_NUZUL.length} causes, ${GHARIB_SIRAJ.length} verses with meanings, ${SURAH_VIRTUES.length} virtues)`);
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });

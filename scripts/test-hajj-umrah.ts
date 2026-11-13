/**
 * Hajj and Umrah guide: every hadith is the edition's text under its number, letter and vowel (al-Albani sahih/hasan
 * for Abu Dawud / al-Tirmidhi, documented typo corrections only), every ayah key holds the intended words, the
 * Hajj-calendar phases, and the public routes.
 *
 *   node scripts/fetch-hadith-editions.cjs && npx tsx scripts/test-hajj-umrah.ts
 */
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { assertAyahRangeContains } from './lib/quran-words';
import { assertVerbatimHadith } from './lib/verbatim';
import {
  HAJJ_HADITH, HAJJ_STEPS, HAJJ_TEXT_CORRECTIONS, HAJJ_VIRTUES, IHRAM_INFO, UMRAH_STEPS, type HajjEvidence,
} from '../src/shared/data/hajj-umrah';
import { getHajjGuide, getHajjToday } from '../src/services/hajj-umrah.service';
import { hajjRouter } from '../src/routes/hajj';
import { dayKeyForHijri } from '../src/shared/utils/hijri';

// Hadith: verbatim with vowels.
for (const h of Object.values(HAJJ_HADITH)) {
  assertVerbatimHadith(h, HAJJ_TEXT_CORRECTIONS.filter((c) => c.id === h.id));
  assert.ok(!h.textAr.includes('ﷺ'), `${h.id}: the honorific goes in leadAr, the text stays as in the edition`);
}
assert.ok(HAJJ_TEXT_CORRECTIONS.every((c) => HAJJ_HADITH[c.id]), 'every correction names a hadith');
// The checks bite: one wrong vowel, a wrong number, a wrong ayah key.
const talbiyah = HAJJ_HADITH.talbiyah;
assert.throws(() => assertVerbatimHadith({ ...talbiyah, textAr: talbiyah.textAr.replace('لَبَّيْكَ', 'لَبِّيْكَ') }), /vowels differ/);
assert.throws(() => assertVerbatimHadith({ ...talbiyah, number: 1550, referenceAr: 'رواه البخاري (1550)' }), /not found/);
assert.throws(() => assertAyahRangeContains(2, 157, 157, 'إن الصفا والمروة من شعائر الله'), /does not contain/);

// Every evidence item: hadith exists, ayah key holds its words; every hadith is used somewhere.
const allEvidence: HajjEvidence[] = [
  ...UMRAH_STEPS.flatMap((s) => s.evidence), ...HAJJ_STEPS.flatMap((s) => s.evidence),
  ...IHRAM_INFO.miqatEvidence, ...IHRAM_INFO.prohibitionsEvidence, ...IHRAM_INFO.typesEvidence, ...HAJJ_VIRTUES,
];
for (const e of allEvidence) {
  if (e.kind === 'hadith') assert.ok(HAJJ_HADITH[e.id], `hadith ${e.id} defined`);
  else assertAyahRangeContains(e.surah, e.from, e.to, e.check, 'hajj');
}
for (const id of Object.keys(HAJJ_HADITH)) assert.ok(allEvidence.some((e) => e.kind === 'hadith' && e.id === id), `hadith ${id} is used`);

// Steps: unique ids, every step cites something, counters are 7, Hajj days cover 8–13 with no gap.
const stepIds = [...UMRAH_STEPS, ...HAJJ_STEPS].map((s) => s.id);
assert.equal(new Set(stepIds).size, stepIds.length - 0, 'step ids unique');
for (const s of [...UMRAH_STEPS, ...HAJJ_STEPS]) {
  assert.ok(s.evidence.length >= 1, `${s.id} cites evidence`);
  if (s.counter) assert.equal(s.counter.target, 7, `${s.id} counter`);
}
for (let d = 8; d <= 13; d++) assert.ok(HAJJ_STEPS.some((s) => s.dhulHijjahDays?.includes(d)), `day ${d} has a step`);
assert.deepEqual(UMRAH_STEPS.map((s) => s.id), ['ihram', 'tawaf', 'tawafPrayer', 'sai', 'halq']);

// DTO: no internal fields; ayah evidence as keys.
const guide = getHajjGuide();
const json = JSON.stringify(guide);
for (const internal of ['"check"', '"collection"', '"number"']) assert.ok(!json.includes(internal), `${internal} is not sent`);
assert.ok(json.includes('"verseKey":"2:158"'));
assert.equal(guide.ihram.mawaqit.length, 5);
assert.ok(Buffer.byteLength(json) < 80000, `guide size ${Buffer.byteLength(json)}`);
const sai = guide.umrah.find((s) => s.id === 'sai')!;
assert.ok(sai.evidence.some((e: any) => e.kind === 'hadith' && e.textAr.includes('كُلِّ شَىْءٍ')), 'corrected vowel is shown');

// Calendar phases (Umm al-Qura, 1448 AH: 9 Dhu al-Hijjah).
const arafah1448 = dayKeyForHijri({ year: 1448, month: 12, day: 9 })!;
const shift = (k: string, n: number) => new Date(Date.parse(k + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
let t = getHajjToday(arafah1448);
assert.deepEqual([t.phase, t.stepIds, t.daysUntilArafah], ['HAJJ_DAYS', ['arafah', 'muzdalifah'], 0]);
assert.deepEqual(getHajjToday(shift(arafah1448, -1)).stepIds, ['tarwiyah']);
assert.deepEqual(getHajjToday(shift(arafah1448, 1)).stepIds, ['muzdalifah', 'nahr']);
assert.deepEqual(getHajjToday(shift(arafah1448, 3)).stepIds, ['tashreeq']);
t = getHajjToday(shift(arafah1448, -5));
assert.deepEqual([t.phase, t.daysUntilArafah], ['TEN_DAYS', 5]);
t = getHajjToday(shift(arafah1448, -40));
assert.equal(t.phase, 'SEASON'); assert.equal(t.daysUntilArafah, 40);
t = getHajjToday(shift(arafah1448, 5)); // 14 Dhu al-Hijjah → next year's Arafah
assert.equal(t.phase, 'OFF_SEASON');
assert.equal(t.arafahDate, dayKeyForHijri({ year: 1449, month: 12, day: 9 }));
assert.ok(t.daysUntilArafah! > 340);
// The user's Hijri correction moves the day: with +1 the day before Arafah already counts as Arafah.
assert.deepEqual(getHajjToday(shift(arafah1448, -1), 1).stepIds, ['arafah', 'muzdalifah']);
// Today (13 Nov 2026, Jumada al-Ula 1448): off season, Arafah of 1448 ahead.
t = getHajjToday('2026-11-13');
assert.equal(t.phase, 'OFF_SEASON'); assert.equal(t.arafahDate, arafah1448);

async function routes() {
  const app = express(); app.use('/hajj', hajjRouter);
  app.use(((error: any, _req: any, res: any, _next: any) => { res.status(error.statusCode ?? (error.name === 'ZodError' ? 400 : 500)).json({ success: false }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hajj`;
    let r = await fetch(`${base}/guide`); assert.equal(r.status, 200);
    assert.equal(((await r.json()) as any).data.umrah.length, 5);
    r = await fetch(`${base}/today?date=${arafah1448}`); assert.equal(r.status, 200);
    assert.equal(((await r.json()) as any).data.phase, 'HAJJ_DAYS');
    assert.equal((await fetch(`${base}/today?timezone=Africa/Cairo&hijriOffset=1`)).status, 200);
    assert.equal((await fetch(`${base}/today?date=2026-13-01`)).status, 400);
    assert.equal((await fetch(`${base}/today?hijriOffset=3`)).status, 400);
    assert.equal((await fetch(`${base}/guide?x=1`)).status, 400);
  } finally { await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))); }
}

routes().then(() => { console.log(`hajj & umrah tests: ALL PASSED (Arafah 1448 = ${arafah1448})`); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });

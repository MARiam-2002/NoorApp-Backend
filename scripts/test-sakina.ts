/**
 * «سكينة»: every ayah key points at the intended words (checked against the local word-by-word Quran data), every
 * hadith is verbatim in its edition under the cited number (al-Albani: sahih for al-Tirmidhi / Abu Dawud), every
 * adhkar reference exists in the reviewed catalog, and the public routes.
 *
 *   node scripts/fetch-hadith-editions.cjs && npx tsx scripts/test-sakina.ts
 */
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { assertAyahRangeContains } from './lib/quran-words';
import { assertVerbatimHadith } from './lib/verbatim';
import { SAKINA_HADITH, SAKINA_MOODS } from '../src/shared/data/sakina';
import { getSakinaAll, getSakinaMood, getSakinaMoods } from '../src/services/sakina.service';
import { sakinaRouter } from '../src/routes/sakina';

const ids = new Set<string>();
for (const m of SAKINA_MOODS) {
  assert.ok(!ids.has(m.id), `duplicate mood ${m.id}`); ids.add(m.id);
  assert.match(m.id, /^[a-z]{2,20}$/);
  assert.ok(m.ayat.length >= 3 && m.adhkar.length >= 1 && m.hadith.length >= 1, `${m.id} has content of each kind`);
  for (const r of m.ayat) {
    assert.ok(r.from <= r.to && r.to - r.from <= 3, `${m.id} ${r.surah}:${r.from}-${r.to} short range`);
    assertAyahRangeContains(r.surah, r.from, r.to, r.check, m.id);
  }
  for (const h of m.hadith) assert.ok(SAKINA_HADITH[h], `${m.id}: hadith ${h} defined`);
}
assert.equal(SAKINA_MOODS.length, 10);

for (const h of Object.values(SAKINA_HADITH)) assertVerbatimHadith(h);
for (const id of Object.keys(SAKINA_HADITH)) assert.ok(SAKINA_MOODS.some((m) => m.hadith.includes(id)), `hadith ${id} is used`);

// Service: adhkar resolve from the catalog (throws on a missing reference), no internal fields leak.
const all = getSakinaAll();
assert.equal(all.moods.length, 10);
const anxious = getSakinaMood('anxious');
assert.equal(anxious.ayat[1].verseKey, '65:2'); assert.equal(anxious.ayat[1].toVerseKey, '65:3');
assert.ok(anxious.adhkar.some((x) => x.category === 'MORNING' && x.textAr.includes('رَوْعَاتِي')), 'MORNING 7 is the روعاتي dua');
assert.ok(!JSON.stringify(all).includes('"check"'), 'check phrases are not sent');
assert.ok(!JSON.stringify(all).includes('"collection"'), 'internal hadith fields are not sent');
assert.ok(Buffer.byteLength(JSON.stringify(all)) < 60000, 'offline payload stays small');
assert.deepEqual(Object.keys(getSakinaMoods().moods[0]), ['id', 'titleAr', 'titleEn', 'feelingAr', 'feelingEn', 'iconKey', 'counts']);
assert.throws(() => getSakinaMood('nope'), (e: any) => e.statusCode === 404);

async function routes() {
  const app = express(); app.use('/sakina', sakinaRouter);
  app.use(((error: any, _req: any, res: any, _next: any) => { res.status(error.statusCode ?? (error.name === 'ZodError' ? 400 : 500)).json({ success: false }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/sakina`;
    let r = await fetch(base); assert.equal(r.status, 200); assert.match(r.headers.get('cache-control') ?? '', /public/);
    assert.equal(((await r.json()) as any).data.moods.length, 10);
    r = await fetch(`${base}/sick`); assert.equal(r.status, 200);
    assert.equal(((await r.json()) as any).data.adhkar[0].category, 'SICK');
    assert.equal((await fetch(`${base}/all`)).status, 200);
    assert.equal((await fetch(`${base}/missing`)).status, 404);
    assert.equal((await fetch(`${base}/BAD_ID`)).status, 400);
    assert.equal((await fetch(`${base}?x=1`)).status, 400);
  } finally { await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))); }
}

routes().then(() => { console.log('sakina tests: ALL PASSED'); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });

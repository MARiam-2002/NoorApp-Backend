/**
 * Dhikr garden: evidence verbatim (letter and vowel), every phrase id is in the tasbih catalog and its text is named
 * in the evidence, and the public route.
 *
 *   node scripts/fetch-hadith-editions.cjs && npx tsx scripts/test-dhikr-garden.ts
 */
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { assertVerbatimHadith } from './lib/verbatim';
import { DHIKR_GARDEN_HADITH, DHIKR_GARDEN_PHRASES } from '../src/shared/data/dhikr-garden';
import { getDhikrArName, listTasbihs } from '../src/services/tasbih.service';
import { tasbihRouter } from '../src/routes/tasbih';

const strip = (s: string) => s.replace(/[ً-ْٰ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي');
for (const h of DHIKR_GARDEN_HADITH) assertVerbatimHadith(h);
const catalogIds = new Set(listTasbihs().map((t) => t.id as string));
for (const p of DHIKR_GARDEN_PHRASES) {
  assert.ok(catalogIds.has(p.dhikr), `${p.dhikr} is in the tasbih catalog`);
  const ev = DHIKR_GARDEN_HADITH.find((h) => h.id === p.evidenceId)!;
  assert.ok(strip(ev.textAr).includes(strip(getDhikrArName(p.dhikr))), `${p.dhikr} («${getDhikrArName(p.dhikr)}») is named in ${ev.id}`);
}
// Phrases that are not named word for word in the evidence never grow the garden.
for (const id of ['SUBHAN_ALLAHI_WA_BIHAMDIHI', 'ASTAGHFIRULLAH', 'LA_ILAHA_ILLA_ALLAH_WAHDAHU']) assert.ok(!DHIKR_GARDEN_PHRASES.some((p) => p.dhikr === id));

(async () => {
  const app = express(); app.use('/tasbih', tasbihRouter);
  app.use(((error: any, _req: any, res: any, _next: any) => { res.status(error.statusCode ?? (error.name === 'ZodError' ? 400 : 500)).json({ success: false }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/tasbih`;
  const r = await fetch(`${base}/garden`); assert.equal(r.status, 200);
  const d = ((await r.json()) as any).data;
  assert.equal(d.phrases.length, 5); assert.equal(d.evidence.length, 3);
  assert.ok(!JSON.stringify(d).includes('"collection"'));
  assert.equal(d.phrases[0].dhikrAr, 'سبحان الله');
  assert.equal((await fetch(`${base}/garden?x=1`)).status, 400);
  assert.equal((await fetch(`${base}/today`)).status, 401, 'private tasbih routes untouched');
  server.close();
  console.log('dhikr garden tests: ALL PASSED');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

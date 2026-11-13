/**
 * GET /quran/tafsir/surah — whole surah of a tafsir for offline reading: verified Muyassar from Noor's data, Al-Qurtubi
 * from the formatted mirror, Quran Foundation (all pages) for the rest; ayat a tafsir does not explain are null; same
 * text as the per-ayah endpoint; 503 when providers fail; cache headers. External calls are mocked.
 *
 *   npx tsx scripts/test-tafsir-surah.ts
 */
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { clearSurahTafsirCache, getAyahTafsir, getSurahTafsir } from '../src/services/quran.service';
import { getMuyassarPassage } from '../src/services/tafsir-muyassar.service';
import { clearQulQurtubiAyahCache } from '../src/lib/qurtubi-qul';
import { quranRouter } from '../src/routes/quran';
import { errorHandler } from '../src/middleware/common';

const realFetch = globalThis.fetch;
const calls: string[] = [];
let failAll = false;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith('http://127.0.0.1')) return realFetch(input, init);
  calls.push(url);
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  if (failAll) return json({ error: 'down' }, 500);
  // Quran Foundation by_chapter: Al-Fatiha in two pages, ayah 4 not explained by this resource.
  let m = url.match(/\/tafsirs\/(\d+)\/by_chapter\/(\d+)\?(.*)$/);
  if (m) {
    const page = Number(new URLSearchParams(m[3]).get('page') ?? 1);
    const rows = page === 1 ? [1, 2, 3].map(a => ({ verse_key: `1:${a}`, text: `<p>تفسير ${m![1]} للآية ${a}</p>` }))
      : [5, 6, 7].map(a => ({ verse_key: `1:${a}`, text: `<p>تفسير ${m![1]} للآية ${a}</p>` }));
    return json({ tafsirs: rows, pagination: { next_page: page === 1 ? 2 : null } });
  }
  m = url.match(/\/tafsirs\/(\d+)\/by_ayah\/(\d+):(\d+)/) ?? url.match(/\/tafsirs\/(\d+)\/by_ayah\/(\d+)%3A(\d+)/);
  if (m) return json({ tafsir: { text: `<p>تفسير ${m[1]} للآية ${m[3]}</p>`, resource_id: Number(m[1]) } });
  // Formatted Al-Qurtubi mirror: one file per surah.
  if (/ar-tafseer-al-qurtubi\/1\.json$/.test(url)) return json([1, 2, 3, 4, 5, 6, 7].map(a => ({ surah: 1, ayah: a, text: `القرطبي ${a}` })));
  return json({ error: 'not mocked' }, 404);
}) as typeof fetch;

(async () => {
  // Verified Muyassar: complete, local (no network), ayah groups carried.
  const muy = await getSurahTafsir(71, 'Ibn_Kathir_Muyassar');
  assert.equal(muy.provider, 'noor_verified');
  assert.equal(muy.ayat.length, 28);
  assert.deepEqual(muy.missingAyat, []);
  assert.deepEqual([muy.ayat[1]!.groupFromAyah, muy.ayat[1]!.groupToAyah], [1, 4]);
  assert.equal(muy.ayat[1]!.textAr, getMuyassarPassage(71, 2)!.textAr);
  assert.equal(calls.length, 0, 'Muyassar needs no provider call');

  // Quran Foundation tafsir: every page merged, unexplained ayah is null, same text as the per-ayah endpoint.
  const ik = await getSurahTafsir(1, 'Ibn_Kathir');
  assert.equal(ik.provider, 'quran_foundation');
  assert.equal(ik.ayat.length, 7);
  assert.deepEqual(ik.missingAyat, [4]);
  assert.equal(ik.ayat[3]!.textAr, null);
  assert.equal(ik.ayat[4]!.textAr, 'تفسير 14 للآية 5');
  assert.equal((await getAyahTafsir(1, 5, 'Ibn_Kathir')).textAr, ik.ayat[4]!.textAr);
  assert.equal(calls.filter(u => u.includes('/by_chapter/1')).length, 2, 'two pages fetched');

  // Second read comes from memory.
  const before = calls.length;
  await getSurahTafsir(1, 'Ibn_Kathir');
  assert.equal(calls.length, before);

  // Al-Qurtubi: formatted mirror, whole surah file.
  clearQulQurtubiAyahCache();
  const q = await getSurahTafsir(1, 'Al_Qurtubi');
  assert.equal(q.provider, 'qul');
  assert.equal(q.ayat[6]!.textAr, 'القرطبي 7');
  assert.equal((await getAyahTafsir(1, 7, 'Al_Qurtubi')).textAr, 'القرطبي 7', 'per-ayah read uses the same text');

  // Providers down: stable 503 contract.
  clearSurahTafsirCache();
  failAll = true;
  await assert.rejects(getSurahTafsir(2, 'Al_Tabari'), (e: any) => e.statusCode === 503);
  failAll = false;

  // Route: validation and cache header.
  const app = express(); app.use('/quran', quranRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/quran`;
  const r = await realFetch(`${base}/tafsir/surah?surahId=112&tafsirId=Ibn_Kathir_Muyassar`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control') ?? '', /public, max-age=86400/);
  const body = await r.json() as any;
  assert.equal(body.data.ayat.length, 4);
  assert.equal((await realFetch(`${base}/tafsir/surah?surahId=115`)).status, 400);
  server.close();
  console.log('tafsir surah tests: ALL PASSED (Muyassar local, QF pages merged, Qurtubi mirror, 503, route)');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

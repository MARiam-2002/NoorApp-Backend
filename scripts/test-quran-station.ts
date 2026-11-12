/**
 * Quran station: radio catalog integrity, daily playlist (deterministic per date), playlist validation,
 * routes (public vs signed-in) and — with HIFZ_TEST_DB=true — the playlist CRUD flow on PostgreSQL (rolled back).
 *
 *   npx tsx scripts/test-quran-station.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { QURAN_RADIOS, RADIO_CATEGORIES } from '../src/shared/data/quran-radios';
import { getRadioStations, getDailyPlaylist, resolveItem, createPlaylist, listPlaylists, updatePlaylist, deletePlaylist, getPlaylist } from '../src/services/quran-station.service';
import { quranStationRouter } from '../src/routes/quran-station';
import { prisma } from '../src/lib/prisma';

// Radios.
assert.ok(QURAN_RADIOS.length >= 150, 'radio list');
assert.equal(new Set(QURAN_RADIOS.map(r => r[0])).size, QURAN_RADIOS.length, 'unique ids');
assert.equal(new Set(QURAN_RADIOS.map(r => r[3])).size, QURAN_RADIOS.length, 'unique streams');
for (const r of QURAN_RADIOS) {
  assert.match(r[3], /^https:\/\/[^\s]+$/, `stream ${r[0]}`);
  assert.ok(r[4] in RADIO_CATEGORIES, `category ${r[0]}`);
  assert.ok(r[1].trim() && !/[-*]$/.test(r[1]), `clean name ${r[0]}: ${r[1]}`);
}
const all = getRadioStations();
assert.equal(all.total, QURAN_RADIOS.length);
assert.equal(all.categories.reduce((n, c) => n + c.count, 0), all.total);
assert.ok(getRadioStations('TAFSIR').stations.every(s => s.category === 'TAFSIR'));
assert.throws(() => getRadioStations('NOPE'), (e: any) => e.statusCode === 400);
// Same reciter twice is told apart by its riwaya/style.
const basit = all.stations.filter(s => s.nameAr === 'عبدالباسط عبدالصمد');
assert.equal(new Set(basit.map(s => s.variantAr)).size, basit.length, 'variants distinguish duplicate names');

// Daily playlist: stable per date, different across dates, 6 distinct surahs in mushaf order, distinct reciters.
const d1 = getDailyPlaylist('2026-11-13');
assert.deepEqual(getDailyPlaylist('2026-11-13'), d1, 'deterministic');
assert.equal(d1.items.length, 6);
assert.deepEqual(d1.items.map(i => i.surahId), [...d1.items.map(i => i.surahId)].sort((a, b) => a - b));
assert.equal(new Set(d1.items.map(i => i.surahId)).size, 6);
assert.equal(new Set(d1.items.map(i => i.recitationId)).size, 6);
assert.ok(d1.items.every(i => i.riwaya === 'Hafs' && /\/\d{3}\.mp3$/.test(i.audioUrl)));
assert.ok(d1.items[0]!.surahId >= 2 && d1.items[0]!.surahId <= 9);
const week = Array.from({ length: 7 }, (_, k) => getDailyPlaylist(`2026-11-${String(13 + k).padStart(2, '0')}`).items.map(i => i.surahId).join(','));
assert.ok(new Set(week).size >= 6, 'changes every day');
assert.throws(() => getDailyPlaylist('13-11-2026'), (e: any) => e.statusCode === 400);

// Resolving stored items.
assert.equal(resolveItem({ kind: 'RADIO', radioId: QURAN_RADIOS[0]![0] }).streamUrl, QURAN_RADIOS[0]![3]);
assert.equal(resolveItem({ kind: 'RADIO', radioId: 999999999 }).available, false, 'removed station stays in the list as unavailable');
assert.deepEqual(resolveItem({ kind: 'VERSES', reciterId: 'Mishary_Alafasy', surahId: 67, fromAyah: 1, toAyah: 5 }).playlistQuery,
  { surahId: 67, fromAyah: 1, toAyah: 5, reciterId: 'Mishary_Alafasy' });

async function routes() {
  const app = express(); app.use(express.json()); app.use('/quran', quranStationRouter);
  app.use(((error: any, _req: any, res: any, _next: any) => { res.status(error.statusCode ?? (error.name === 'ZodError' ? 400 : 500)).json({ success: false }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/quran`;
    const radio = await fetch(`${base}/radio?category=LIVE`); assert.equal(radio.status, 200);
    assert.equal(radio.headers.get('cache-control'), 'public, max-age=86400');
    const daily = await fetch(`${base}/playlists/daily?date=2026-11-13`); assert.equal(daily.status, 200);
    assert.deepEqual(((await daily.json()) as any).data.items.map((i: any) => i.surahId), d1.items.map(i => i.surahId));
    assert.equal((await fetch(`${base}/playlists/daily?timezone=Africa/Cairo`)).status, 200);
    assert.equal((await fetch(`${base}/playlists/daily?date=bad`)).status, 400);
    for (const [m, p] of [['GET', '/playlists'], ['POST', '/playlists'], ['GET', '/playlists/7d3c9a52-6a43-4f0b-9b6c-1a0f2a3b4c5d'], ['DELETE', '/playlists/7d3c9a52-6a43-4f0b-9b6c-1a0f2a3b4c5d']]) {
      assert.equal((await fetch(base + p, { method: m })).status, 401, `${m} ${p} needs sign-in`);
    }
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}

async function db() {
  if (process.env.HIFZ_TEST_DB !== 'true') { console.log('SKIP playlist DB flow: set HIFZ_TEST_DB=true'); return; }
  const rollback = new Error('ROLLBACK');
  try {
    await prisma.$transaction(async (tx: any) => {
      const exists = await tx.$queryRawUnsafe(`SELECT to_regclass('public.quran_playlists')::text AS t`);
      if (!exists[0].t) await tx.$executeRawUnsafe(readFileSync('prisma/migrations/20261113100000_station_and_sunnah_fasting/migration.sql', 'utf8'));
      await tx.$executeRawUnsafe(`INSERT INTO users(id, username, email, timezone, "updatedAt") VALUES ('pl-user','pl-user','pl@test.local','Africa/Cairo', now()), ('pl-other','pl-other','plo@test.local','Africa/Cairo', now())`);
      const items = [
        { kind: 'SURAH', recitationId: d1.items[0]!.recitationId, surahId: 18 },
        { kind: 'VERSES', reciterId: 'Mishary_Alafasy', surahId: 2, fromAyah: 255, toAyah: 257 },
        { kind: 'RADIO', radioId: QURAN_RADIOS[0]![0] },
      ];
      const p = await createPlaylist('pl-user', { name: 'قبل النوم', items }, tx);
      assert.equal(p.itemCount, 3); assert.equal(p.revision, 0);
      assert.ok(p.items[0].audioUrl.endsWith('/018.mp3'));
      await assert.rejects(createPlaylist('pl-user', { name: 'x', items: [{ kind: 'VERSES', reciterId: 'Mishary_Alafasy', surahId: 1, fromAyah: 1, toAyah: 8 }] }, tx), (e: any) => e.statusCode === 400, 'range beyond the surah');
      await assert.rejects(createPlaylist('pl-user', { name: 'x', items: [{ kind: 'VERSES', reciterId: 'Warsh_Ibrahim_Al_Dosary', surahId: 1, fromAyah: 1, toAyah: 2 }] }, tx), (e: any) => e.statusCode === 400, 'Warsh verse files are not verse-synced');
      await assert.rejects(createPlaylist('pl-user', { name: 'x', items: [{ kind: 'RADIO', radioId: 1, extra: true }] }, tx), (e: any) => e.name === 'ZodError');
      const up = await updatePlaylist('pl-user', p.id, { name: 'ورد الليل', items: items.slice(0, 2), revision: 0 }, tx);
      assert.equal(up.revision, 1); assert.equal(up.itemCount, 2);
      await assert.rejects(updatePlaylist('pl-user', p.id, { name: 'قديم', items: [], revision: 0 }, tx), (e: any) => e.statusCode === 409, 'stale revision');
      await assert.rejects(getPlaylist('pl-other', p.id, tx), (e: any) => e.statusCode === 404, 'other users cannot read it');
      assert.equal((await listPlaylists('pl-user', tx)).playlists.length, 1);
      assert.deepEqual(await deletePlaylist('pl-user', p.id, tx), { deleted: true });
      await assert.rejects(deletePlaylist('pl-user', p.id, tx), (e: any) => e.statusCode === 404);
      console.log('playlist DB flow passed (rolled back)');
      throw rollback;
    }, { timeout: 60000 });
  } catch (e) { if (e !== rollback) throw e; }
}

routes().then(db).then(async () => {
  await prisma.$disconnect().catch(() => undefined);
  console.log(`quran station tests: ALL PASSED (${QURAN_RADIOS.length} stations)`);
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });

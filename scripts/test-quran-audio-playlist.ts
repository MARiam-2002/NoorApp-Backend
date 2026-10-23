import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { quranRouter } from '../src/routes/quran';
import { getQuranAudioCatalog, getQuranAudioPlaylist } from '../src/services/quran-audio-playlist.service';
import { getAyahAudio } from '../src/services/quran.service';
import { CATALOG_SURAHS } from '../src/data/surahs';
import { prisma } from '../src/lib/prisma';

async function main() {
  const catalog = await getQuranAudioCatalog();
  assert.equal(catalog.defaultReciterId, 'Mishary_Alafasy');
  assert.equal(new Set(catalog.reciters.map(r => r.id)).size, catalog.reciters.length);
  let total = 0;
  for (const surah of CATALOG_SURAHS) {
    const playlist = getQuranAudioPlaylist({ surahId: surah.id });
    assert.equal(playlist.items.length, surah.totalAyahs);
    assert.equal(playlist.items[0].ayahNumber, 1);
    assert.equal(playlist.items.at(-1)?.ayahNumber, surah.totalAyahs);
    total += playlist.items.length;
  }
  assert.equal(total, 6236);
  for (const reciter of catalog.reciters) {
    const p = getQuranAudioPlaylist({ surahId: 2, fromAyah: 255, toAyah: 256, reciterId: reciter.id });
    assert.equal(p.items[0].audioUrl, `${reciter.serverUrl}/002255.mp3`);
    assert.equal(p.items[1].verseKey, '2:256');
    assert.equal(p.qualityKbps, reciter.availableQualities[0]);
    assert.ok(p.items[0].cacheKey.includes(reciter.id));
  }
  const bad = [
    { surahId: 1, toAyah: 8 }, { surahId: 9, fromAyah: 0 },
    { surahId: 114, fromAyah: 5, toAyah: 2 }, { surahId: 115 },
    { surahId: 1, reciterId: 'unverified_external_id' },
    { surahId: 1, reciterId: 'Mahmoud_Ali_Al_Banna', qualityKbps: 128 },
  ];
  for (const input of bad) assert.throws(() => getQuranAudioPlaylist(input), e => (e as any).statusCode === 400);
  await assert.rejects(getAyahAudio(1, 8, 'Mishary_Alafasy'));
  await assert.rejects(getAyahAudio(1, 1, 'unknown'));
  assert.equal(getQuranAudioPlaylist({ surahId: 1, reciterId: '2' }).reciter.id, 'Abdul_Basit');
  const app = express();
  app.use('/quran', quranRouter);
  app.use(((error: any, _req: any, res: any, _next: any) => {
    res.status(error.statusCode ?? (error.name === 'ZodError' ? 400 : 500)).json({ success: false });
  }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/quran`;
    const c = await fetch(`${base}/audio/catalog`);
    assert.equal(c.status, 200);
    assert.equal(c.headers.get('cache-control'), 'public, max-age=300');
    assert.equal(((await c.json()) as any).data.catalogVersion, 1);
    const p = await fetch(`${base}/audio/playlist?surahId=114&reciterId=Mahmoud_Ali_Al_Banna`);
    assert.equal(p.status, 200);
    assert.equal(((await p.json()) as any).data.items.length, 6);
    for (const query of ['surahId=1&toAyah=8', 'surahId=1&fromAyah=0', 'surahId=1&reciterId=unknown', 'surahId=abc']) {
      assert.equal((await fetch(`${base}/audio/playlist?${query}`)).status, 400);
    }
    assert.equal((await fetch(`${base}/audio?surahId=1&ayahNumber=8`)).status, 400);
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
  console.log('All 114 surahs / 6236 verse coordinates, reader metadata, ranges, qualities and invalid selections passed');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

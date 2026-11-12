/**
 * Quran library datasets: checksums, coverage, lookups (verse panel, word panel, statistics, topics, surah info,
 * rub index, khatmah templates), routes; with HIFZ_TEST_DB=true also the annotations flow on PostgreSQL (rolled back).
 *
 *   npx tsx scripts/test-quran-library.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { libraryManifest, getAyahLibrary, getAyahWords, getWord, getRootOccurrences, getTopicTree, getTopic, getSurahInfo, getRubIndex, wordKey } from '../src/services/quran-library.service';
import { listAnnotations, upsertAnnotation, deleteAnnotation } from '../src/services/quran-annotations.service';
import { quranInsightsRouter } from '../src/routes/quran-insights';
import { KHATMAH_TEMPLATES } from '../src/shared/data/khatmah-templates';
import { prisma } from '../src/lib/prisma';

const m = libraryManifest();
assert.deepEqual(Object.keys(m.files).sort(), ['e3rab', 'morphology', 'mukhtasar', 'qiraat', 'similar', 'surahs', 'topics']);

// Verse panel.
const kursi = getAyahLibrary(2, 255);
assert.ok(kursi.mukhtasar.text && kursi.mukhtasar.text.length > 50);
assert.match(kursi.irab.text!, /^٢٥٥ - ﴿/);
assert.ok(kursi.topics.topics.length > 0);
const fatiha6 = getAyahLibrary(1, 6);
const sirat = fatiha6.qiraat.words.find(w => wordKey(w.word).includes('صراط'))!;
assert.ok(sirat.variants.some(v => v.text.includes('بالسين') && v.readers.some(r => r.rawi === 'قنبل')));
assert.ok(sirat.variants.flatMap(v => v.readers).every(r => r.audioUrl === null || r.audioUrl.startsWith('https://files.quranpedia.net/recitations/')));
const sim = getAyahLibrary(1, 7).similar;
assert.ok(sim.groups.length > 0 && sim.groups.every(g => g.verses.every(v => v.verseKey !== '1:7')), 'similar verses exclude the verse itself');
assert.equal(getAyahLibrary(2, 255).mukhtasar.source.bookAr, 'المختصر في تفسير القرآن الكريم');
for (let s = 1; s <= 114; s += 13) assert.ok(getAyahLibrary(s, 1).mukhtasar.text, `mukhtasar ${s}:1`);
assert.throws(() => getAyahLibrary(1, 8), (e: any) => e.statusCode === 400);

// Word panel and statistics (Surah app shows for غير: root in 46 surahs and 146 verses).
const words = getAyahWords(1, 7).words;
const ghayr = words.find(w => wordKey(w.text) === 'غير')!;
assert.equal(ghayr.root, 'غير');
assert.equal(ghayr.statistics.rootSurahs, 46);
assert.equal(ghayr.statistics.rootAyahs, 146);
assert.match(ghayr.audioUrl, /^https:\/\/audio\.qurancdn\.com\/wbw\/001_007_00\d\.mp3$/);
const w = getWord(1, 1, 1);
assert.equal(w.segments[0]!.role, 'prefix');
assert.ok(w.statistics.exactOccurrences > 0 && w.statistics.wordOccurrences >= w.statistics.exactOccurrences);
assert.throws(() => getWord(1, 1, 9), (e: any) => e.statusCode === 400);
const hmd = getRootOccurrences('حمد');
assert.ok(hmd.occurrences > 60 && hmd.verseKeys.includes('1:2'));
assert.throws(() => getRootOccurrences('ققق'), (e: any) => e.statusCode === 404);
let total = 0; for (let s = 1; s <= 114; s++) total += getSurahInfo(s).statistics.words;
assert.ok(total > 77000 && total < 78000, `total words ${total}`);

// Topics, surah info, rub index, khatmah templates.
const tree = getTopicTree();
assert.ok(tree.topics.length > 10);
const t = getTopic(tree.topics[0]!.children[0]?.id ?? tree.topics[0]!.id);
assert.ok(t.verseKeys.length > 0);
const info = getSurahInfo(1);
assert.equal(info.statistics.type, 'مكية');
assert.equal(info.statistics.revelationOrder, 5);
assert.ok(info.names && info.purposes && info.statistics.ayahCountByCounting.length >= 4);
const rubs = getRubIndex();
assert.equal(rubs.length, 240);
assert.deepEqual([rubs[0]!.verseKey, rubs[0]!.page, rubs[239]!.verseKey, rubs[239]!.page], ['1:1', 1, '100:9', 599]);
assert.ok(rubs.every((r, i) => i === 0 || r.page >= rubs[i - 1]!.page));
assert.ok(rubs.every(r => r.opening && !r.opening.includes('۞')));
assert.deepEqual(KHATMAH_TEMPLATES.map(x => x.id), ['SALAF_7_DAYS', 'RAMADAN_30', 'DAILY_PRAYERS', 'CUSTOM']);
const salaf = KHATMAH_TEMPLATES[0].days!;
assert.ok(salaf.every((d, i) => i === 0 || d.fromSurah === salaf[i - 1]!.toSurah + 1) && salaf[6]!.toSurah === 114);

async function routes() {
  const app = express();
  app.use(express.json());
  app.use('/quran', quranInsightsRouter);
  app.use(((error: any, _req: any, res: any, _next: any) => { res.status(error.statusCode ?? error.status ?? (error.name === 'ZodError' ? 400 : 500)).json({ success: false }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/quran`;
    for (const ok of ['ayah-library?surahId=2&ayahNumber=255', 'ayah-words?surahId=1&ayahNumber=7', 'word?surahId=1&ayahNumber=7&position=4',
      `roots/${encodeURIComponent('حمد')}`, 'topics', 'surahs/18/info', 'index/rub', 'khatmah/templates', `search/meaning?q=${encodeURIComponent('الصبر')}`, 'audio/surah-reciters?riwaya=Warsh']) {
      assert.equal((await fetch(`${base}/${ok}`)).status, 200, ok);
    }
    assert.equal((await fetch(`${base}/recitation/check`, { method: 'POST' })).status, 401, 'recitation check requires sign-in');
    for (const bad of ['ayah-library?surahId=1&ayahNumber=8', 'word?surahId=1&ayahNumber=1&position=0', 'roots/abc', 'surahs/0/info']) {
      assert.equal((await fetch(`${base}/${bad}`)).status, 400, bad);
    }
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}

async function db() {
  if (process.env.HIFZ_TEST_DB !== 'true') { console.log('SKIP annotations DB flow: set HIFZ_TEST_DB=true'); return; }
  const rollback = new Error('ROLLBACK');
  try {
    await prisma.$transaction(async (tx: any) => {
      const exists = await tx.$queryRawUnsafe(`SELECT to_regclass('public.quran_annotations') AS t`);
      if (!exists[0].t) await tx.$executeRawUnsafe(readFileSync('prisma/migrations/20261112140000_quran_annotations/migration.sql', 'utf8'));
      await tx.$executeRawUnsafe(`INSERT INTO users(id, username, email, timezone, "updatedAt") VALUES ('ann-user', 'ann-user', 'ann@test.local', 'Africa/Cairo', now())`);
      const a = await upsertAnnotation('ann-user', 'madani-hafs', { verseKey: '1:7', wordPosition: 4, color: 'PINK' }, tx);
      const b = await upsertAnnotation('ann-user', 'madani-hafs', { verseKey: '2:255', comment: 'أعظم آية', tag: 'تدبر' }, tx);
      const a2 = await upsertAnnotation('ann-user', 'madani-hafs', { verseKey: '1:7', wordPosition: 4, color: 'GREEN', comment: 'غير', tag: 'لغة' }, tx);
      assert.equal(a2.id, a.id, 'same word updates in place');
      await assert.rejects(upsertAnnotation('ann-user', 'madani-hafs', { verseKey: '1:8' }, tx), (e: any) => e.name === 'ZodError');
      await assert.rejects(upsertAnnotation('ann-user', 'madani-hafs', { verseKey: '1:1' }, tx), (e: any) => e.name === 'ZodError', 'colour or comment required');
      const all = await listAnnotations('ann-user', 'madani-hafs', {}, tx);
      assert.equal(all.items.length, 2);
      assert.deepEqual(all.tags, ['تدبر', 'لغة']);
      assert.equal((await listAnnotations('ann-user', 'madani-hafs', { type: 'highlights' }, tx)).items.length, 1);
      assert.equal((await listAnnotations('ann-user', 'madani-hafs', { tag: 'تدبر' }, tx)).items[0]!.id, b.id);
      assert.equal((await listAnnotations('ann-user', 'madani-hafs', { surahId: '1' }, tx)).items.length, 1);
      await assert.rejects(deleteAnnotation('someone-else', b.id, tx), (e: any) => e.statusCode === 404);
      await deleteAnnotation('ann-user', b.id, tx);
      assert.equal((await listAnnotations('ann-user', 'madani-hafs', {}, tx)).items.length, 1);
      console.log('annotations DB flow passed (rolled back)');
      throw rollback;
    }, { timeout: 60000 });
  } catch (e) { if (e !== rollback) throw e; }
}

routes().then(db).then(async () => {
  await prisma.$disconnect().catch(() => undefined);
  console.log('quran library tests: ALL PASSED');
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });

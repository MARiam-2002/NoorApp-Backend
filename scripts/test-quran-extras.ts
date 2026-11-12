/**
 * Recitation check (alignment), search by meaning, full-surah recitation catalog and the translation catalog.
 * With HIFZ_TEST_DB=true the recitation check also runs against verse text in PostgreSQL (rolled back).
 *
 *   npx tsx scripts/test-quran-extras.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alignRecitation, wordDistance, skeleton, checkRecitation, type ExpectedWord } from '../src/services/recitation-check.service';
import { searchByMeaning } from '../src/services/quran-library.service';
import { getSurahAudioCatalog } from '../src/services/surah-audio.service';
import { listTranslations, sanitizeAyahText } from '../src/services/quran.service';
import { prisma } from '../src/lib/prisma';

const quran = JSON.parse(readFileSync('prisma/data/quran-uthmani.json', 'utf8'));
const verses = (s: number) => quran.surahs.find((x: any) => x.number === s).ayahs as Array<{ numberInSurah: number; text: string }>;
const expectedOf = (s: number): ExpectedWord[] => verses(s).flatMap(a => sanitizeAyahText({ surahId: s, ayahNumber: a.numberInSurah, textAr: a.text }).textAr.split(/\s+/).filter(w => skeleton(w)).map((text, i) => ({ verseKey: `${s}:${a.numberInSurah}`, position: i + 1, text })));

// Skeleton and distance: ASR output has no diacritics and may write alef where Uthmani omits it.
assert.equal(wordDistance('ٱلرَّحْمَٰنِ', 'الرحمن'), 0);
assert.equal(wordDistance('صِرَٰطَ', 'صراط'), 0);
assert.equal(wordDistance('ٱلْعَٰلَمِينَ', 'العالمين'), 0);
assert.equal(wordDistance('ٱلرَّحِيمِ', 'الرحمن'), 2);

// Al-Ikhlas recited perfectly (as ASR would write it).
const ikhlas = expectedOf(112);
let r = alignRecitation(ikhlas, 'قل هو الله احد الله الصمد لم يلد ولم يولد ولم يكن له كفوا احد');
assert.equal(r.counts.correct + r.counts.minor, ikhlas.length);
assert.equal(r.accuracy, 100);
assert.equal(r.extra.length, 0);
// A skipped word, a wrong word and an extra word.
r = alignRecitation(ikhlas, 'قل هو الله احد الله الرحيم لم يلد ولم يولد ولم يكن كفوا احد احد');
assert.equal(r.words.find(w => w.verseKey === '112:2' && w.position === 2)!.status, 'WRONG');
assert.equal(r.words.find(w => w.verseKey === '112:4' && w.position === 3)!.status, 'MISSED');
assert.equal(r.extra.length, 1);
// Stopping early is reported as "not reached", not as many mistakes.
r = alignRecitation(ikhlas, 'قل هو الله احد الله الصمد');
assert.equal(r.reachedWords, 6);
assert.deepEqual(r.stoppedAt, { verseKey: '112:2', position: 2 });
// Longer passage stays fast.
const mulk = expectedOf(67);
const t0 = Date.now();
r = alignRecitation(mulk, mulk.map(w => skeleton(w.text)).join(' '));
assert.equal(r.accuracy, 100);
assert.ok(Date.now() - t0 < 2000, 'alignment of a whole surah is fast');

// Search by meaning.
const m = searchByMeaning('الصبر على البلاء');
assert.ok(m.total > 0 && m.results.length > 0);
assert.ok(m.results.every(x => x.snippet.length > 0));
const prayer = searchByMeaning('الصلاة');
assert.ok(prayer.total > 50);
assert.throws(() => searchByMeaning('ا'), (e: any) => e.statusCode === 400);

// Full-surah recitations.
const cat = getSurahAudioCatalog();
assert.equal(cat.total, 213);
assert.ok(cat.reciterCount >= 170);
assert.ok(cat.riwayat.find(x => x.key === 'Warsh')!.count >= 10 && cat.riwayat.find(x => x.key === 'Qalun')!.count >= 10);
assert.ok(cat.recitations.every(x => /^https:\/\/[a-z0-9.]+\.mp3quran\.net\/.+\/001\.mp3$/.test(x.example)));
assert.equal(getSurahAudioCatalog('Warsh').recitations.every(x => x.riwaya === 'Warsh'), true);

async function main() {
  const tr = await listTranslations();
  assert.ok(tr.length >= 45, `translations ${tr.length}`);
  assert.equal(new Set(tr.map(t => t.id)).size, tr.length);
  assert.equal(new Set(tr.map(t => t.resourceId)).size, tr.length, 'unique resource ids');
  assert.ok(new Set(tr.map(t => t.languageCode)).size >= 30, 'at least 30 languages');
  if (process.env.HIFZ_TEST_DB === 'true') {
    const rollback = new Error('ROLLBACK');
    try {
      await prisma.$transaction(async (tx: any) => {
        await tx.$executeRawUnsafe(`INSERT INTO surahs(id, "nameEn", "nameAr", "totalPages", "totalAyahs") VALUES (112, 'Al-Ikhlas', 'الإخلاص', 1, 4) ON CONFLICT (id) DO NOTHING`);
        for (const a of verses(112)) await tx.$executeRawUnsafe(`INSERT INTO ayahs(id, "surahId", "ayahNumber", "textAr", page) VALUES ($1, 112, $2, $3, 604) ON CONFLICT DO NOTHING`, `x-112-${a.numberInSurah}`, a.numberInSurah, a.text);
        const res = await checkRecitation({ surahId: 112, fromAyah: 1, toAyah: 4, transcript: 'قل هو الله احد الله الصمد لم يلد ولم يولد ولم يكن له كفوا احد' }, tx);
        assert.equal(res.accuracy, 100);
        await assert.rejects(checkRecitation({ surahId: 112, fromAyah: 1, toAyah: 5, transcript: 'x' }, tx), (e: any) => e.statusCode === 400);
        console.log('recitation check DB flow passed (rolled back)');
        throw rollback;
      });
    } catch (e) { if (e !== rollback) throw e; }
  }
  await prisma.$disconnect().catch(() => undefined);
  console.log('quran extras tests: ALL PASSED');
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

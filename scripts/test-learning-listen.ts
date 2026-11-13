/**
 * «استمع» scripts for learning items: built for every item from sources only — ayat recited (never text-to-speech),
 * «التفسير الميسر» for exactly the recited ayat (Quran wording inside it never spoken), hadith word for word, Noor's own
 * wording only in fiqh/tajweed lessons and marked editorial — plus the tafsir in the reader and the public route.
 *
 *   npx tsx scripts/test-learning-listen.ts
 */
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { LEARNING_COLLECTIONS_DATA } from '../src/shared/data/learning-content';
import { getLearningListen, LISTEN_MODE, tafsirSpeech, toSpeech } from '../src/services/learning-listen.service';
import { LEARNING_TAFSIR_PASSAGES } from '../src/shared/data/learning-tafsir';
import { getLearningItem } from '../src/services/learning.service';
import { execFileSync } from 'node:child_process';
import { learningRouter } from '../src/routes/learning';

execFileSync('npx', ['tsx', 'scripts/build-learning-tafsir.ts', '--check'], { stdio: 'inherit' });

let items = 0, ayahSegs = 0, tafsirSegs = 0;
const passageTexts = new Set(Object.values(LEARNING_TAFSIR_PASSAGES).map(p => p.textAr));
for (const c of LEARNING_COLLECTIONS_DATA) for (const item of c.items) {
  items++;
  const l = getLearningListen(item.id);
  const allText = [item.titleAr, ...item.sections.flatMap(s => [s.titleAr, ...s.paragraphsAr, s.reflectionAr ?? '', ...s.nawawi.map(n => n.textAr)])];
  assert.ok(LISTEN_MODE[c.id], `${c.id}: listening mode set`);
  assert.equal(l.mode, LISTEN_MODE[c.id]);
  for (const [i, seg] of l.segments.entries()) {
    if (seg.type === 'title' || seg.type === 'narration') assert.ok(allText.includes(seg.textAr), `${item.id}: narration comes from the item`);
    if (seg.type === 'narration') {
      assert.equal(l.mode, 'LESSON', `${item.id}: Noor's own wording is never read in stories, seerah, aqeedah, asma or Nawawi`);
      assert.equal(seg.editorial, true);
    }
    if (seg.type === 'tafsir') {
      tafsirSegs++;
      assert.ok(passageTexts.has(seg.textAr), `${item.id}: tafsir text is the verified passage`);
      assert.ok(!/[﴿﴾]/.test(seg.speechAr), `${item.id}: Quran wording in the tafsir is not spoken`);
      assert.ok(seg.speechAr.length > 10);
      assert.notEqual(c.id, 'tajweed');
      // Explains ayat that were just recited: the previous recited block overlaps the passage's ayah group.
      const prev = l.segments.slice(0, i).reverse().find(x => x.type === 'ayah') as { surah: number; fromAyah: number; toAyah: number } | undefined;
      assert.ok(prev && prev.surah === seg.surah && prev.fromAyah <= seg.toAyah && prev.toAyah >= seg.fromAyah, `${item.id}: tafsir follows its ayat`);
    }
    if ('speechAr' in seg) {
      assert.ok(!seg.speechAr.includes('ﷺ'), `${item.id}: honorific spelled out`);
      assert.ok(!/[«»﴿﴾]/.test(seg.speechAr), `${item.id}: no quote marks read aloud`);
    }
    if (seg.type === 'ayah') {
      ayahSegs++;
      const block = item.sections.flatMap(s => s.quran).find(q => q.surah === seg.surah && q.fromAyah === seg.fromAyah && q.toAyah === seg.toAyah);
      assert.ok(block, `${item.id}: ayah segment matches a cited block`);
      assert.deepEqual(seg.verseKeys, block!.verses.map(v => v.verseKey));
      assert.ok(!('speechAr' in seg), 'ayat are recited, never spoken by TTS');
    }
  }
  // Every cited Quran block appears once as a recited segment.
  assert.equal(l.segments.filter(s => s.type === 'ayah').length, item.sections.reduce((a, s) => a + s.quran.length, 0), `${item.id}: all ayat recited`);
  assert.ok(l.estimatedSeconds > 0);
}
assert.equal(toSpeech('قال رسول الله ﷺ: «الدين النصيحة»'), 'قال رسول الله صلى الله عليه وسلم: الدين النصيحة');
assert.equal(toSpeech('واذكر -أيها الرسول- للناس'), 'واذكر، أيها الرسول، للناس');
assert.equal(tafsirSpeech('وهي قوله تعالى: ﴿رَبَّنا ظَلَمۡنآ أَنفُسَنا﴾، فتاب الله عليه'), 'وهي قوله تعالى، فتاب الله عليه');
// Stories are told by sources: Noah's listening has the tafsir of Nuh 1–4 right after the recitation, and no retelling.
const nuhL = getLearningListen('nuh');
assert.equal(nuhL.mode, 'SOURCES');
assert.ok(!nuhL.segments.some(s => s.type === 'narration'));
const firstAyah = nuhL.segments.findIndex(s => s.type === 'ayah');
const after = nuhL.segments[firstAyah + 1]!;
assert.equal(after.type, 'tafsir');
assert.ok(after.type === 'tafsir' && after.textAr.startsWith('إنا بعثنا نوحًا إلى قومه'));
assert.ok(nuhL.sourcesAr.some(x => x.includes('التفسير الميسر')));
assert.ok(getLearningListen(LEARNING_COLLECTIONS_DATA.find(c => c.id === 'tajweed')!.items[0]!.id).segments.every(s => s.type !== 'tafsir'));
assert.throws(() => getLearningListen('nope'), (e: any) => e.statusCode === 404);
const nuh = getLearningListen('nuh');
assert.equal(nuh.segments[0].type, 'title');
assert.ok(nuh.segments.some(s => s.type === 'ayah' && s.surah === 71));

(async () => {
  // Reader: every Quran block outside tajweed carries its tafsir passages.
  const reader = await getLearningItem('nuh') as any;
  assert.equal(reader.tafsirSource.titleAr, 'التفسير الميسر');
  for (const s of reader.sections) for (const q of s.quran) assert.ok(q.tafsir.length > 0 && q.tafsir.every((p: any) => passageTexts.has(p.textAr)));
  const app = express(); app.use('/learning', learningRouter);
  app.use(((error: any, _q: any, res: any, _n: any) => { res.status(error.statusCode ?? 500).json({ success: false }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/learning`;
  const r = await fetch(`${base}/items/nuh/listen`); assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control') ?? '', /public/);
  assert.equal((await fetch(`${base}/items/nope/listen`)).status, 404);
  server.close();
  console.log(`learning listen tests: ALL PASSED (${items} items, ${ayahSegs} recited ayah segments, ${tafsirSegs} tafsir segments)`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

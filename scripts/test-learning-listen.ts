/**
 * «استمع» scripts for learning items: built for every item, no text that is not in the item, every ayah block becomes
 * a recited segment (never text-to-speech), the honorific is spelled out for speech, and the public route.
 *
 *   npx tsx scripts/test-learning-listen.ts
 */
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { LEARNING_COLLECTIONS_DATA } from '../src/shared/data/learning-content';
import { getLearningListen, toSpeech } from '../src/services/learning-listen.service';
import { learningRouter } from '../src/routes/learning';

let items = 0, ayahSegs = 0;
for (const c of LEARNING_COLLECTIONS_DATA) for (const item of c.items) {
  items++;
  const l = getLearningListen(item.id);
  const allText = [item.titleAr, ...item.sections.flatMap(s => [s.titleAr, ...s.paragraphsAr, s.reflectionAr ?? '', ...s.nawawi.map(n => n.textAr)])];
  for (const seg of l.segments) {
    if (seg.type === 'title' || seg.type === 'narration') assert.ok(allText.includes(seg.textAr), `${item.id}: narration comes from the item`);
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
assert.throws(() => getLearningListen('nope'), (e: any) => e.statusCode === 404);
const nuh = getLearningListen('nuh');
assert.equal(nuh.segments[0].type, 'title');
assert.ok(nuh.segments.some(s => s.type === 'ayah' && s.surah === 71));

(async () => {
  const app = express(); app.use('/learning', learningRouter);
  app.use(((error: any, _q: any, res: any, _n: any) => { res.status(error.statusCode ?? 500).json({ success: false }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/learning`;
  const r = await fetch(`${base}/items/nuh/listen`); assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control') ?? '', /public/);
  assert.equal((await fetch(`${base}/items/nope/listen`)).status, 404);
  server.close();
  console.log(`learning listen tests: ALL PASSED (${items} items, ${ayahSegs} recited ayah segments)`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

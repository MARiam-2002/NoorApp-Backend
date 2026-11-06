import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma';
import { ayahText } from './lib/quran-lookup';
import { normalizeArabicForSearch } from '../src/shared/utils/arabic-normalize';

const plain = (t: string) => normalizeArabicForSearch(t).replace(/\s+/g, ' ').trim();
import { LEARNING_COLLECTIONS_DATA } from '../src/shared/data/learning-content';
import { getLearningCollection, getLearningHub, getLearningItem, learningProgressSchema, saveLearningProgress } from '../src/services/learning.service';

async function contentChecks() {
  const ids = LEARNING_COLLECTIONS_DATA.map(c => c.id);
  assert.deepEqual(ids, ['prophet-stories', 'seerah', 'companions', 'aqeedah', 'asma-husna', 'fiqh', 'tajweed', 'nawawi-forty', 'morals']);
  const stories = LEARNING_COLLECTIONS_DATA.find(c => c.id === 'prophet-stories')!;
  assert.deepEqual(stories.items.map(i => i.id), ['adam', 'idris', 'nuh', 'hud', 'salih', 'ibrahim', 'ismail', 'lut', 'ishaq-yaqub', 'yusuf', 'ayyub',
    'shuayb', 'musa', 'harun', 'dawud', 'sulayman', 'ilyas-alyasa-dhulkifl', 'yunus', 'zakariyya-yahya', 'isa']);
  // Quiz options are shuffled at build time; the right answer must still be the one the author marked.
  const { LEARNING_COLLECTIONS } = await import('./lib/learning/catalog');
  const authored = new Map(LEARNING_COLLECTIONS.flatMap(c => c.items.map(i => [i.id, i.quiz] as const)));
  let notFirst = 0;
  for (const c of LEARNING_COLLECTIONS_DATA) for (const item of c.items) item.quiz.forEach((q, i) => {
    const src = authored.get(item.id)![i]!;
    assert.equal(q.optionsAr[q.correctIndex], src.optionsAr[src.correctIndex], `${item.id} quiz ${i + 1}`);
    assert.deepEqual([...q.optionsAr].sort(), [...src.optionsAr].sort());
    if (q.correctIndex !== 0) notFirst += 1;
  });
  assert.ok(notFirst > 30, 'answers are not always the first option');
  const fiqh = LEARNING_COLLECTIONS_DATA.find(c => c.id === 'fiqh')!;
  assert.equal(fiqh.items.length, 13);
  assert.ok(fiqh.items.every(i => i.sections.every(s => s.quran.length + s.hadith.length > 0)), 'every fiqh section cites its evidence');
  assert.equal(fiqh.items.find(i => i.id === 'siyam-la-yufattir')!.sections[0]!.hadith[0]!.number, 1933);
  assert.equal(fiqh.items.find(i => i.id === 'siyam-qiyam-qadr')!.sections[1]!.quran[0]!.verses[0]!.textAr, ayahText(97, 1));
  assert.ok(!ayahText(97, 1).includes('سْمِ'), 'Basmala (stored with a shadda in 97:1) is stripped');
  for (const item of stories.items) {
    for (const s of item.sections) assert.ok(s.quran.length + s.hadith.length > 0, `${item.id}: uncited section`);
    for (const q of item.quiz) assert.ok(q.correctIndex < q.optionsAr.length);
  }
  // Spot checks of verbatim text and numbering.
  const adam = stories.items.find(i => i.id === 'adam')!;
  assert.equal(adam.sections[0]!.quran[0]!.verses[0]!.verseKey, '2:30');
  assert.equal(adam.sections[0]!.quran[0]!.verses[0]!.textAr, ayahText(2, 30));
  assert.ok(plain(adam.sections[0]!.quran[0]!.verses[0]!.textAr).startsWith(plain('وإذ قال ربك للملائكة')));
  assert.equal(adam.sections[1]!.hadith[0]!.number, 6227);
  const nuh = stories.items.find(i => i.id === 'nuh')!;
  assert.ok(!nuh.sections[0]!.quran[0]!.verses[0]!.textAr.includes('بِسْمِ'), 'Basmala is not part of ayah 71:1');
  const nawawi = LEARNING_COLLECTIONS_DATA.find(c => c.id === 'nawawi-forty')!;
  assert.equal(nawawi.items.length, 42);
  assert.ok(plain(nawawi.items[0]!.sections[0]!.nawawi[0]!.textAr).includes(plain('إنما الأعمال بالنيات')));
  assert.ok(!nawawi.items.some(i => i.sections[0]!.nawawi[0]!.textAr.includes('<br')));
  for (const c of LEARNING_COLLECTIONS_DATA) if (c.existingEndpoint) assert.equal(c.items.length, 0, `${c.id} must not duplicate an existing section`);
  assert.equal(learningProgressSchema.safeParse({ lastSectionIndex: 1, quizScore: 2 }).success, false);
  assert.equal(learningProgressSchema.safeParse({ lastSectionIndex: 1, quizScore: 4, quizTotal: 3 }).success, false);
  assert.equal(learningProgressSchema.safeParse({ lastSectionIndex: 1, note: 'x' }).success, false);

  // Everything in the build is live.
  const hub = await getLearningHub();
  assert.equal(hub.collections.find(c => c.id === 'prophet-stories')!.itemCount, 20);
  assert.equal(hub.collections.find(c => c.id === 'fiqh')!.itemCount, 13);
  assert.equal(hub.collections.find(c => c.id === 'prophet-stories')!.comingSoon, false);
  assert.equal(hub.collections.find(c => c.id === 'seerah')!.comingSoon, true);
  assert.equal(hub.collections.find(c => c.id === 'companions')!.comingSoon, false);
  assert.equal(hub.collections.find(c => c.id === 'companions')!.existingEndpoint, '/content/figures');
  const musa = await getLearningItem('musa');
  assert.equal((musa as any).draft, undefined);
  assert.equal((musa as any).review, undefined, 'internal review metadata is not sent');
  assert.equal(musa.previousItemId, 'shuayb');
  assert.equal(musa.nextItemId, 'harun');
  assert.equal((await getLearningItem('adam')).previousItemId, null);
  assert.equal((await getLearningItem('isa')).nextItemId, null);
  assert.equal((await getLearningCollection('nawawi-forty')).items.length, 42);
  await assert.rejects(getLearningCollection('unknown'), /not found/);
  await assert.rejects(getLearningItem('unknown'), /not found/);

  // The committed generated file matches the sources (only where the pinned sources are present).
  if (existsSync('prisma/data/hadith/ara-nawawi.json') && existsSync('prisma/data/hadith/ara-bukhari.json')) {
    execFileSync(process.execPath, ['--import', 'tsx', 'scripts/build-learning-content.ts', '--check'], { stdio: 'pipe' });
  } else {
    console.log('SKIP build --check: pinned hadith editions are not in prisma/data/hadith');
  }
}

async function dbChecks() {
  const original = { tx: prisma.$transaction.bind(prisma), query: prisma.$queryRaw, exec: prisma.$executeRaw };
  const rollback = new Error('LEARNING_TEST_ROLLBACK');
  const schema = 'learning_test_' + randomUUID().replace(/-/g, '');
  try {
    await original.tx(async (tx: any) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe(`CREATE TABLE users(id TEXT PRIMARY KEY)`);
      const { readFileSync } = await import('node:fs');
      for (const st of readFileSync('prisma/migrations/20261106100000_learning_progress/migration.sql', 'utf8').split(';')
        .map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim()).filter(Boolean)) await tx.$executeRawUnsafe(st);
      await tx.$executeRaw`INSERT INTO users(id) VALUES ('reader'), ('other')`;
      (prisma as any).$queryRaw = tx.$queryRaw.bind(tx);
      (prisma as any).$executeRaw = tx.$executeRaw.bind(tx);
      let r = await saveLearningProgress('reader', 'yusuf', { lastSectionIndex: 3 });
      assert.equal(r.progress!.lastSectionIndex, 3);
      r = await saveLearningProgress('reader', 'yusuf', { lastSectionIndex: 1 });
      assert.equal(r.progress!.lastSectionIndex, 3, 'never moves back');
      r = await saveLearningProgress('reader', 'yusuf', { lastSectionIndex: 6, completed: true, quizScore: 2, quizTotal: 3 });
      assert.equal(r.progress!.completed, true);
      assert.equal(r.progress!.quizBestScore, 67);
      r = await saveLearningProgress('reader', 'yusuf', { lastSectionIndex: 6, quizScore: 1, quizTotal: 3 });
      assert.equal(r.progress!.quizBestScore, 67, 'best score kept');
      await assert.rejects(saveLearningProgress('reader', 'yusuf', { lastSectionIndex: 7 }), /past the last section/);
      await assert.rejects(saveLearningProgress('reader', 'yusuf', { lastSectionIndex: 1, quizScore: 1, quizTotal: 5 }), /quizTotal/);
      await saveLearningProgress('reader', 'musa', { lastSectionIndex: 2 });
      const hub = await getLearningHub('reader');
      assert.equal(hub.collections.find(c => c.id === 'prophet-stories')!.completedCount, 1);
      assert.deepEqual(hub.continueReading.map(i => i.id), ['musa']);
      assert.equal((await getLearningItem('yusuf', 'other')).progress, null, 'progress is per user');
      await assert.rejects(saveLearningProgress('reader', 'unknown', { lastSectionIndex: 0 }), /not found/);
      await tx.$executeRaw`DELETE FROM users WHERE id = 'reader'`;
      const left: any[] = await tx.$queryRaw`SELECT count(*)::int AS n FROM learning_progress`;
      assert.equal(left[0].n, 0);
      console.log('Learning progress isolated PostgreSQL checks passed: furthest section, first completion, best quiz score, validation, per-user isolation and deletion cascade. All DB changes rolled back.');
      throw rollback;
    }, { timeout: 60000 });
  } catch (e) {
    if (e !== rollback) throw e;
  } finally {
    (prisma as any).$transaction = original.tx; (prisma as any).$queryRaw = original.query; (prisma as any).$executeRaw = original.exec;
    await prisma.$disconnect();
  }
}

async function main() {
  await contentChecks();
  if (process.env.LEARNING_TEST_DB !== 'true') {
    console.log('Learning content checks passed: 9 sections, 20 prophet stories and 13 fiqh-of-fasting lessons with cited sections, 42 Nawawi hadith verbatim, no duplicate of existing sections, all items live. Set LEARNING_TEST_DB=true for isolated PostgreSQL progress checks.');
    return;
  }
  await dbChecks();
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

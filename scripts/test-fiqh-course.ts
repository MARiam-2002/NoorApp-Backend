/**
 * «الفقه الميسر» course: the generated data is up to date with its sources and fixes, every hadith block is the
 * edition's text letter and vowel, every quoted ayah is in the Quran, matn corrections are in place, structure,
 * routes and (with HIFZ_TEST_DB=true) progress on PostgreSQL in a rolled-back transaction.
 *
 *   node scripts/fetch-hadith-editions.cjs && npx tsx scripts/test-fiqh-course.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { assertVerbatimHadith } from './lib/verbatim';
import { assertAyahRangeContains, findQuranPassage } from './lib/quran-words';
import { FIQH_HADITH } from './data/fiqh-muyassar/hadith';
import { FIQH_BOOKS, FIQH_GLOSSARY, FIQH_LESSONS, FIQH_REVIEW_NOTES } from '../src/shared/data/fiqh-course';
import { getFiqhCourse, getFiqhCourseAll, getFiqhLesson, saveFiqhProgress } from '../src/services/fiqh-course.service';
import { learningRouter } from '../src/routes/learning';
import { prisma } from '../src/lib/prisma';

// 1. Generated file matches sources + editorial layer.
execFileSync('npx', ['tsx', 'scripts/build-fiqh-course.ts', '--check'], { stdio: 'pipe' });

// 2. Hadith blocks: letter and vowel; every defined hadith is used.
for (const [id, h] of Object.entries(FIQH_HADITH)) assertVerbatimHadith({ id, ...h });
const used = new Set(FIQH_LESSONS.flatMap(l => l.explanation.filter(b => b.type === 'hadith').map(b => (b as any).id)));
for (const id of Object.keys(FIQH_HADITH)) assert.ok(used.has(id), `hadith ${id} is used`);

// 3. Quran: ayah blocks exist; every ﴿…﴾ quote in matn and explanation is Quran text.
let quotes = 0;
for (const l of FIQH_LESSONS) {
  for (const b of l.explanation) if (b.type === 'ayah') assertAyahRangeContains(b.surah, b.fromAyah, b.toAyah, '', `lesson ${l.id}`);
  const texts = [l.matnAr, ...l.explanation.map(b => ('text' in b ? b.text : ''))];
  for (const t of texts) for (const m of t.matchAll(/[﴿{]([^﴾}]{3,})[﴾}]/g)) {
    quotes++;
    assert.ok(findQuranPassage(m[1]), `lesson ${l.id}: «${m[1].slice(0, 60)}» is not Quran text`);
  }
}
assert.ok(quotes > 40, `${quotes} ayah quotes checked`);

// 4. Structure.
assert.equal(FIQH_LESSONS.length, 89);
assert.equal(new Set(FIQH_LESSONS.map(l => l.id)).size, 89);
for (const l of FIQH_LESSONS) {
  assert.match(l.title, /^المسألة /, `lesson ${l.id} title`);
  assert.ok(l.matnAr.length > 30, `lesson ${l.id} matn`);
  if (l.video) {
    assert.match(l.video.youtubeId, /^[A-Za-z0-9_-]{11}$/);
    if (l.video.endSeconds !== null) assert.ok(l.video.endSeconds > (l.video.startSeconds ?? 0), `lesson ${l.id} video range`);
  }
  for (const c of l.citations) assert.match(c.referenceAr, /^رواه (البخاري|مسلم|أبو داود|الترمذي) \(\d+\)/);
  const json = JSON.stringify(l);
  assert.ok(!/المهندس|صحيحة في الكتاب والحمد لله|ولا زياده عليها/.test(json), `lesson ${l.id}: editor notes or names left in text`);
}
assert.equal(FIQH_BOOKS.length, 14);
assert.deepEqual(FIQH_BOOKS.filter(b => b.available).map(b => b.titleAr), ['كتاب الطهارة', 'كتاب الصلاة']);
assert.equal(FIQH_BOOKS.flatMap(b => b.chapters.flatMap(c => c.lessonIds)).length, 89);
assert.equal(FIQH_LESSONS.filter(l => l.explanation.length === 0).length, 22, 'lessons where the explainer added nothing');
// Matn corrections that change the meaning are in place.
const lesson = (id: number) => FIQH_LESSONS.find(l => l.id === id)!;
assert.ok(lesson(72).matnAr.includes('فيسن لهما الجمع بينهما') && !lesson(72).matnAr.includes('فليس لهما'));
assert.ok(lesson(51).matnAr.includes('بالحيض لمن كانت تحيض'));
assert.ok(lesson(59).matnAr.includes('أن يكون عالمًا بالأوقات'));
assert.ok(lesson(41).matnAr.includes('لأنه عبادة'));
assert.ok(lesson(1).explanation.some(b => 'text' in b && b.text === 'النجاسات ثلاثة أنواع:'));
// Glossary.
assert.equal(FIQH_GLOSSARY.length, 68);
assert.ok(!FIQH_GLOSSARY.some(g => /قرره النص|ذكر النص|وفقًا لما ورد في النص/.test(g.definitionAr)));
assert.ok(Object.keys(FIQH_REVIEW_NOTES).length > 10, 'review notes kept for reviewers');

// 5. Service + routes.
(async () => {
  const course = await getFiqhCourse('fiqh-muyassar');
  assert.equal(course.books[0].chapters[0].lessons[0].id, 1);
  const l1 = await getFiqhLesson('fiqh-muyassar', 1);
  assert.equal(l1.previousId, null); assert.equal(l1.nextId, 2);
  assert.ok(l1.glossary.some(g => g.term === 'الطهارة'));
  const all = Buffer.from(JSON.stringify(getFiqhCourseAll('fiqh-muyassar')));
  assert.ok(gzipSync(all).length < 150000, `offline bundle ${gzipSync(all).length} bytes gzipped (the API compresses responses)`);
  await assert.rejects(getFiqhLesson('fiqh-muyassar', 999), (e: any) => e.statusCode === 404);
  assert.throws(() => getFiqhCourseAll('nope'), (e: any) => e.statusCode === 404);

  const app = express(); app.use(express.json()); app.use('/learning', learningRouter);
  app.use(((error: any, _q: any, res: any, _n: any) => { res.status(error.statusCode ?? (error.name === 'ZodError' ? 400 : 500)).json({ success: false }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/learning`;
  try {
    assert.equal((await fetch(`${base}/courses/fiqh-muyassar/all`)).status, 200);
    assert.equal((await fetch(`${base}/courses/fiqh-muyassar/glossary`)).status, 200);
    assert.equal((await fetch(`${base}/courses/nope/all`)).status, 404);
    assert.equal((await fetch(`${base}/courses/fiqh-muyassar/lessons/1/progress`, { method: 'PUT' })).status, 401);
  } finally { server.close(); }

  // 6. Progress on PostgreSQL.
  if (process.env.HIFZ_TEST_DB === 'true') {
    const rollback = new Error('ROLLBACK');
    try {
      await prisma.$transaction(async (tx: any) => {
        const ex = await tx.$queryRawUnsafe(`SELECT to_regclass('public.learning_progress')::text AS t`);
        if (!ex[0].t) await tx.$executeRawUnsafe(readFileSync('prisma/migrations/20261106100000_learning_progress/migration.sql', 'utf8'));
        await tx.$executeRawUnsafe(`INSERT INTO users(id, username, email, "updatedAt") VALUES ('fq-a','fq-a','fq@test.local', now())`);
        let r = await saveFiqhProgress('fq-a', 'fiqh-muyassar', 3, { completed: true }, tx);
        assert.deepEqual([r.completed, r.completedCount], [true, 1]);
        r = await saveFiqhProgress('fq-a', 'fiqh-muyassar', 3, { completed: true }, tx);
        assert.equal(r.completedCount, 1, 'idempotent');
        r = await saveFiqhProgress('fq-a', 'fiqh-muyassar', 3, { completed: false }, tx);
        assert.deepEqual([r.completed, r.completedCount], [false, 0]);
        await assert.rejects(saveFiqhProgress('fq-a', 'fiqh-muyassar', 3, { completed: 'yes' }, tx), (e: any) => e.name === 'ZodError');
        await assert.rejects(saveFiqhProgress('fq-a', 'fiqh-muyassar', 999, { completed: true }, tx), (e: any) => e.statusCode === 404);
        console.log('fiqh course progress DB flow passed (rolled back)');
        throw rollback;
      });
    } catch (e) { if (e !== rollback) throw e; }
  }
  await prisma.$disconnect().catch(() => undefined);
  console.log(`fiqh course tests: ALL PASSED (${quotes} ayah quotes, ${Object.keys(FIQH_HADITH).length} hadith blocks)`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

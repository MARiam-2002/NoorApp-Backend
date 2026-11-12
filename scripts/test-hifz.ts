/**
 * Memorization (hifz): portion order, spaced-review ladder, question builder (pure), routes require auth, and —
 * with HIFZ_TEST_DB=true — the full flow on PostgreSQL inside a rolled-back transaction.
 *
 *   npx tsx scripts/test-hifz.ts
 *   HIFZ_TEST_DB=true npx tsx scripts/test-hifz.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { AddressInfo } from 'node:net';
import {
  nextPortion, planSurahOrder, scheduleReview, buildHifzQuestions, HIFZ_REVIEW_INTERVALS, type AyahText,
  saveHifzPlan, getHifzToday, addHifzSegment, reviewHifzSegment, getHifzProgress, getHifzTest, deleteHifzSegment, setHifzPlanStatus, deleteHifzPlan,
} from '../src/services/hifz.service';
import { hifzRouter } from '../src/routes/hifz';
import { prisma } from '../src/lib/prisma';
import { CATALOG_SURAHS } from '../src/data/surahs';

// ---- pure
assert.deepEqual(planSurahOrder({ fromSurah: 112, toSurah: 114, direction: 'BACKWARD' }), [114, 113, 112]);
assert.deepEqual(planSurahOrder({ fromSurah: 1, toSurah: 3, direction: 'FORWARD' }), [1, 2, 3]);
const back = { fromSurah: 78, toSurah: 114, direction: 'BACKWARD' as const };
assert.deepEqual(nextPortion(back, [], 5), { surahId: 114, nameAr: nextPortion(back, [], 5)!.nameAr, fromAyah: 1, toAyah: 5, verseCount: 5 });
assert.equal(nextPortion(back, [{ surahId: 114, fromAyah: 1, toAyah: 5 }], 5)!.toAyah, 6, 'stops at the end of the surah');
assert.equal(nextPortion(back, [{ surahId: 114, fromAyah: 1, toAyah: 6 }], 5)!.surahId, 113, 'moves to the next surah of the plan');
assert.deepEqual((({ surahId, fromAyah, toAyah }) => ({ surahId, fromAyah, toAyah }))(nextPortion(back, [{ surahId: 114, fromAyah: 3, toAyah: 6 }], 5)!), { surahId: 114, fromAyah: 1, toAyah: 2 }, 'fills gaps, never overlaps');
assert.equal(nextPortion({ fromSurah: 114, toSurah: 114, direction: 'FORWARD' }, [{ surahId: 114, fromAyah: 1, toAyah: 6 }], 5), null, 'plan complete');
assert.equal(nextPortion(back, [], 0), null);
assert.deepEqual(scheduleReview(0, 'GOOD', '2026-11-12'), { stage: 1, nextReviewDay: '2026-11-15', intervalDays: 3 });
assert.deepEqual(scheduleReview(2, 'AGAIN', '2026-11-12'), { stage: 0, nextReviewDay: '2026-11-13', intervalDays: 1 });
assert.deepEqual(scheduleReview(2, 'HARD', '2026-11-12'), { stage: 2, nextReviewDay: '2026-11-16', intervalDays: 4 });
assert.equal(scheduleReview(5, 'EASY', '2026-11-12').stage, HIFZ_REVIEW_INTERVALS.length - 1, 'capped at the top stage');

const quran = JSON.parse(readFileSync('prisma/data/quran-uthmani.json', 'utf8'));
const textsOf = (ids: number[]): AyahText[] => ids.flatMap(id => quran.surahs.find((s: any) => s.number === id).ayahs.map((a: any) => ({ surahId: id, ayahNumber: a.numberInSurah, textAr: a.text })));
const ctx = textsOf([67, 112, 113, 114]);
const qs = buildHifzQuestions(ctx.filter(a => a.surahId === 67), ctx, { count: 9, types: ['NEXT_AYAH', 'COMPLETE_AYAH', 'WHICH_SURAH'], seed: 42, testedSurahs: [67] });
assert.equal(qs.length, 9);
for (const q of qs) {
  assert.equal(q.options.length, 4);
  assert.equal(new Set(q.options.map(o => o.text)).size, 4, 'distinct options');
  const correct = q.options.find(o => o.id === q.correctOptionId)!;
  const [s, a] = q.answerVerseKey.split(':').map(Number);
  const answer = ctx.find(x => x.surahId === s && x.ayahNumber === a)!;
  if (q.type === 'NEXT_AYAH') { assert.equal(correct.text, answer.textAr); assert.equal(a, Number(q.promptVerseKey.split(':')[1]) + 1); }
  if (q.type === 'COMPLETE_AYAH') assert.ok(answer.textAr.endsWith(correct.text) && q.prompt.endsWith('…'));
  if (q.type === 'WHICH_SURAH') assert.equal(correct.text, CATALOG_SURAHS.find(x => x.id === 67)!.nameAr);
}
assert.deepEqual(buildHifzQuestions(ctx.filter(a => a.surahId === 67), ctx, { count: 3, types: ['NEXT_AYAH'], seed: 7, testedSurahs: [67] }),
  buildHifzQuestions(ctx.filter(a => a.surahId === 67), ctx, { count: 3, types: ['NEXT_AYAH'], seed: 7, testedSurahs: [67] }), 'deterministic per seed');
const correctPositions = new Set(qs.map(q => q.correctOptionId.slice(-1)));
assert.ok(correctPositions.size > 1, 'correct answer position varies');

async function routes() {
  const app = express();
  app.use(express.json());
  app.use('/hifz', hifzRouter);
  app.use(((error: any, _req: any, res: any, _next: any) => { res.status(error.statusCode ?? 500).json({ success: false }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hifz`;
    for (const path of ['/plan', '/today', '/progress', '/test']) assert.equal((await fetch(base + path)).status, 401, path);
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}

async function db() {
  if (process.env.HIFZ_TEST_DB !== 'true') { console.log('SKIP DB flow: set HIFZ_TEST_DB=true'); return; }
  const migration = readFileSync('prisma/migrations/20261112120000_hifz_memorization/migration.sql', 'utf8');
  const rollback = new Error('ROLLBACK');
  try {
    await prisma.$transaction(async (tx: any) => {
      const exists = await tx.$queryRawUnsafe(`SELECT to_regclass('public.hifz_plans') AS t`);
      if (!exists[0].t) await tx.$executeRawUnsafe(migration);
      await tx.$executeRawUnsafe(`INSERT INTO users(id, username, email, timezone, "updatedAt") VALUES ('hifz-user', 'hifz-user', 'hifz-user@test.local', 'Africa/Cairo', now()), ('hifz-other', 'hifz-other', 'hifz-other@test.local', 'Africa/Cairo', now())`);
      for (const id of [112, 113, 114]) {
        const s = quran.surahs.find((x: any) => x.number === id);
        await tx.$executeRawUnsafe(`INSERT INTO surahs(id, "nameEn", "nameAr", "totalPages", "totalAyahs") VALUES ($1, $2, $3, 1, $4) ON CONFLICT (id) DO NOTHING`, id, s.englishName ?? `S${id}`, s.name ?? `S${id}`, s.ayahs.length);
        for (const a of s.ayahs) {
          await tx.$executeRawUnsafe(`INSERT INTO ayahs(id, "surahId", "ayahNumber", "textAr", page) VALUES ($1, $2, $3, $4, 604) ON CONFLICT DO NOTHING`, `t-${id}-${a.numberInSurah}`, id, a.numberInSurah, a.text);
        }
      }
      const day1 = new Date('2026-11-12T08:00:00Z'); // 10:00 in Cairo
      const plan = await saveHifzPlan('hifz-user', { fromSurah: 112, toSurah: 114, direction: 'BACKWARD', dailyNewVerses: 4, reviewLimit: 10, reciterId: 'Mahmoud_Al_Husary_Muallim', reminderEnabled: true, reminderTime: '06:00' }, tx);
      assert.equal(plan.scopeVerses, 4 + 5 + 6);
      let today = await getHifzToday('hifz-user', day1, tx);
      assert.equal(today.day, '2026-11-12');
      assert.deepEqual([today.newPortion!.surahId, today.newPortion!.fromAyah, today.newPortion!.toAyah], [114, 1, 4]);
      assert.deepEqual(today.newPortion!.pages, [604]);
      assert.equal(today.reviews.length, 0);
      const seg = await addHifzSegment('hifz-user', { surahId: 114, fromAyah: 1, toAyah: 4 }, day1, tx);
      await assert.rejects(addHifzSegment('hifz-user', { surahId: 114, fromAyah: 4, toAyah: 6 }, day1, tx), (e: any) => e.statusCode === 409, 'no overlap');
      await assert.rejects(addHifzSegment('hifz-user', { surahId: 114, fromAyah: 5, toAyah: 7 }, day1, tx), (e: any) => e.statusCode === 400, 'inside the surah');
      today = await getHifzToday('hifz-user', day1, tx);
      assert.equal(today.newPortion, null);
      assert.equal(today.newDoneToday, true);
      const day2 = new Date('2026-11-13T08:00:00Z');
      today = await getHifzToday('hifz-user', day2, tx);
      assert.deepEqual([today.newPortion!.surahId, today.newPortion!.fromAyah, today.newPortion!.toAyah], [114, 5, 6]);
      assert.equal(today.reviews.length, 1);
      assert.equal(today.reviews[0]!.segmentId, seg.id);
      const reviewed = await reviewHifzSegment('hifz-user', seg.id, 'GOOD', day2, tx);
      assert.equal(reviewed.stage, 1);
      assert.equal(reviewed.nextReviewDay, '2026-11-16');
      await assert.rejects(reviewHifzSegment('hifz-other', seg.id, 'GOOD', day2, tx), (e: any) => e.statusCode === 404, 'other users cannot touch it');
      assert.equal((await getHifzToday('hifz-user', day2, tx)).reviews.length, 0);
      await addHifzSegment('hifz-user', { surahId: 114, fromAyah: 5, toAyah: 6 }, day2, tx);
      const progress = await getHifzProgress('hifz-user', day2, tx);
      assert.equal(progress.memorizedVerses, 6);
      assert.deepEqual(progress.memorizedSurahs, [114]);
      assert.equal(progress.scopePercent, 40);
      const test = await getHifzTest('hifz-user', { count: '4', seed: '3' }, tx);
      assert.ok(test.questions.length >= 3);
      assert.ok(test.questions.every(q => q.promptVerseKey.startsWith('114:')));
      await assert.rejects(getHifzTest('hifz-other', {}, tx), (e: any) => e.statusCode === 409);
      const ranged = await getHifzTest('hifz-other', { surahId: '112', count: '2', types: 'WHICH_SURAH', seed: '1' }, tx);
      assert.equal(ranged.questions.length, 2);
      await setHifzPlanStatus('hifz-user', 'PAUSED', tx);
      assert.equal((await getHifzToday('hifz-user', day2, tx)).newPortion, null, 'paused plans give no new portion');
      await deleteHifzSegment('hifz-user', seg.id, tx);
      await deleteHifzPlan('hifz-user', false, tx);
      assert.equal((await getHifzProgress('hifz-user', day2, tx)).memorizedVerses, 2, 'progress kept when the plan is deleted');
      console.log('hifz DB flow passed (rolled back)');
      throw rollback;
    }, { timeout: 60000 });
  } catch (e) { if (e !== rollback) throw e; }
}

routes().then(db).then(async () => {
  await prisma.$disconnect().catch(() => undefined);
  console.log('hifz tests: ALL PASSED');
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });

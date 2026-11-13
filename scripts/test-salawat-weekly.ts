/**
 * Weekly salawat gathering: evidence verbatim (Abu Dawud graded sahih by al-Albani, Muslim), the Thursday-Maghrib →
 * Friday-Maghrib window (with and without a location), routes, and — with HIFZ_TEST_DB=true — idempotent counting,
 * the closed-window 409 and the weekly cap on PostgreSQL (rolled back).
 *
 *   node scripts/fetch-hadith-editions.cjs && npx tsx scripts/test-salawat-weekly.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { findSahihPhrase, tirmidhiGrades } from './lib/sahihayn-lookup';
import { SALAWAT_WEEKLY_EVIDENCE, SALAWAT_WEEKLY_LIMITS, salawatWindow, addSalawatCount, getSalawatWeeklyMine } from '../src/services/salawat-weekly.service';
import { salawatRouter } from '../src/routes/salawat';
import { prisma } from '../src/lib/prisma';

for (const e of SALAWAT_WEEKLY_EVIDENCE) {
  assert.ok(findSahihPhrase(e.collection, e.textAr).some(h => h.number === e.number), `${e.id} verbatim`);
  if (e.collection === 'abudawud') assert.equal(tirmidhiGrades(e.number, 'abudawud')['Al-Albani'], 'Sahih');
}

const cairo = { latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo', city: 'Cairo', azanPreferences: {}, prayerCalculationMethod: 'EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY' };
// Thursday 12 Nov 2026, 20:00 Cairo (18:00Z): open, week of Friday 13 Nov.
let w = salawatWindow(cairo, new Date('2026-11-12T18:00:00Z'));
assert.deepEqual([w.weekKey, w.isOpen, w.estimatedTimes], ['2026-11-13', true, false]);
assert.ok(w.opensAt < '2026-11-12T15:30:00Z' && w.opensAt > '2026-11-12T14:30:00Z', `Thursday Maghrib ${w.opensAt}`);
// Thursday 12:00 Cairo: not open yet, same week.
w = salawatWindow(cairo, new Date('2026-11-12T10:00:00Z'));
assert.deepEqual([w.weekKey, w.isOpen], ['2026-11-13', false]);
// Friday 13 Nov 12:00 Cairo: open; Friday 20:00: closed → next week.
assert.equal(salawatWindow(cairo, new Date('2026-11-13T10:00:00Z')).isOpen, true);
w = salawatWindow(cairo, new Date('2026-11-13T18:00:00Z'));
assert.deepEqual([w.weekKey, w.isOpen], ['2026-11-20', false]);
// Monday: next Friday.
assert.equal(salawatWindow(cairo, new Date('2026-11-16T10:00:00Z')).weekKey, '2026-11-20');
// No location: 18:00 local, marked as estimated.
w = salawatWindow({ ...cairo, latitude: null, longitude: null }, new Date('2026-11-12T18:00:00Z'));
assert.deepEqual([w.opensAt, w.closesAt, w.estimatedTimes], ['2026-11-12T16:00:00.000Z', '2026-11-13T16:00:00.000Z', true]);

async function routes() {
  const app = express(); app.use(express.json()); app.use('/salawat', salawatRouter);
  app.use(((error: any, _req: any, res: any, _next: any) => { res.status(error.statusCode ?? (error.name === 'ZodError' ? 400 : 500)).json({ success: false }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/salawat`;
    assert.equal((await fetch(`${base}/weekly/me`)).status, 401);
    assert.equal((await fetch(`${base}/weekly/count`, { method: 'POST' })).status, 401);
    assert.equal((await fetch(`${base}/weekly?bad=1`)).status, 400);
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}

async function db() {
  if (process.env.HIFZ_TEST_DB !== 'true') { console.log('SKIP salawat DB flow: set HIFZ_TEST_DB=true'); return; }
  const rollback = new Error('ROLLBACK');
  try {
    await prisma.$transaction(async (tx: any) => {
      const ex = await tx.$queryRawUnsafe(`SELECT to_regclass('public.salawat_weekly_counts')::text AS t`);
      if (!ex[0].t) await tx.$executeRawUnsafe(readFileSync('prisma/migrations/20261113120000_salawat_weekly/migration.sql', 'utf8'));
      await tx.$executeRawUnsafe(`INSERT INTO users(id, username, email, timezone, latitude, longitude, "updatedAt") VALUES ('sw-a','sw-a','swa@test.local','Africa/Cairo',30.0444,31.2357, now()), ('sw-b','sw-b','swb@test.local','Africa/Cairo',NULL,NULL, now())`);
      const open = new Date('2026-11-12T18:00:00Z');
      const b1 = '6f1c2a90-1111-4c1d-9a00-000000000001';
      let r = await addSalawatCount('sw-a', { batchId: b1, count: 100 }, open, tx);
      assert.deepEqual([r.myCount, r.duplicate, r.communityTotal, r.participants], [100, false, 100, 1]);
      r = await addSalawatCount('sw-a', { batchId: b1, count: 100 }, open, tx);
      assert.deepEqual([r.myCount, r.duplicate], [100, true], 'a retried batch is not counted twice');
      r = await addSalawatCount('sw-b', { batchId: '6f1c2a90-1111-4c1d-9a00-000000000002', count: 33 }, open, tx);
      assert.deepEqual([r.myCount, r.communityTotal, r.participants], [33, 133, 2], 'shared total of everyone');
      await assert.rejects(addSalawatCount('sw-a', { batchId: '6f1c2a90-1111-4c1d-9a00-000000000003', count: 1 }, new Date('2026-11-14T10:00:00Z'), tx), (e: any) => e.statusCode === 409, 'closed on Saturday');
      await assert.rejects(addSalawatCount('sw-a', { batchId: 'x', count: 1 }, open, tx), (e: any) => e.name === 'ZodError');
      await assert.rejects(addSalawatCount('sw-a', { batchId: '6f1c2a90-1111-4c1d-9a00-000000000004', count: 1001 }, open, tx), (e: any) => e.name === 'ZodError');
      for (let i = 0; i < 101; i++) r = await addSalawatCount('sw-a', { batchId: `6f1c2a90-2222-4c1d-9a00-${String(i).padStart(12, '0')}`, count: 1000 }, open, tx);
      assert.deepEqual([r.myCount, r.capped], [SALAWAT_WEEKLY_LIMITS.maxPerWeek, true], 'weekly cap');
      const me = await getSalawatWeeklyMine('sw-a', open, tx);
      assert.deepEqual([me.weekKey, me.myCount, me.isOpen], ['2026-11-13', 100000, true]);
      console.log('salawat weekly DB flow passed (rolled back)');
      throw rollback;
    }, { timeout: 120000 });
  } catch (e) { if (e !== rollback) throw e; }
}

routes().then(db).then(async () => {
  await prisma.$disconnect().catch(() => undefined);
  console.log('salawat weekly tests: ALL PASSED');
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });

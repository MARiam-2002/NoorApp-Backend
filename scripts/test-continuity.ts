import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { prisma } from '../src/lib/prisma';
import { generateAccessToken } from '../src/lib/auth';
import { errorHandler } from '../src/middleware/common';
import { continuityRouter } from '../src/routes/continuity';
import { getSwaggerSpec } from '../src/lib/swagger';
import { calculateContinuity, continuityDayEndsAt, continuityMonthSchema, continuityPreferencePatchSchema,
  issueContinuityContext, resolveContinuityCompletionDay, shiftContinuityDay } from '../src/services/continuity-core';
import { completeContinuityAdhkar, creditContinuityDay, ensureContinuity, getContinuityAdhkarTarget, getContinuityCalendar,
  getContinuityOfflineContext, getContinuitySummary, updateContinuityPreferences, prepareReadingContinuity } from '../src/services/continuity.service';
import { creditReadingUnits, confirmReadingUnits, readingConfirmationSchema } from '../src/services/reading-progress.service';
import { readingGoalReader } from '../src/services/reading-goal.service';
import { evaluateContinuityReminder, runContinuityReminders, continuityReminderDelivery } from '../src/services/continuity-reminder.service';
import { localDayKeyForTimezone } from '../src/shared/utils/user-local-date';

async function main() {
  const today = '2026-10-19';
  assert.equal(calculateContinuity([], today).currentStreak, 0);
  const first = calculateContinuity(['2026-10-17', '2026-10-18'], today);
  assert.equal(first.currentStreak, 2); assert.equal(first.completedToday, false); assert.equal(first.status, 'CONTINUE_TODAY');
  const broken = calculateContinuity(['2026-10-16', '2026-10-17'], today);
  assert.equal(broken.currentStreak, 0); assert.equal(broken.bestStreak, 2); assert.equal(broken.totalCompletedDays, 2);
  const leap = calculateContinuity(['2028-02-28', '2028-02-29', '2028-03-01', '2028-03-01', '2028-03-03'], '2028-03-01');
  assert.equal(leap.currentStreak, 3); assert.equal(leap.totalCompletedDays, 3);
  assert.equal(calculateContinuity(['2026-12-31', '2027-01-01'], '2027-01-01').currentStreak, 2);
  const hundred = Array.from({ length: 100 }, (_, i) => shiftContinuityDay(today, i - 99));
  assert.ok(calculateContinuity(hundred, today).milestones.every(m => m.achieved));
  assert.equal(continuityPreferencePatchSchema.safeParse({ expectedRevision: 0 }).success, false);
  assert.equal(continuityPreferencePatchSchema.safeParse({ expectedRevision: 0, remindersEnabled: 'true' }).success, false);
  assert.equal(continuityPreferencePatchSchema.safeParse({ expectedRevision: 0, reminderMinutesBeforeMidnight: 59 }).success, false);
  assert.equal(continuityPreferencePatchSchema.safeParse({ expectedRevision: 0, timezone: 'UTC', remindersEnabled: true }).success, false);
  assert.equal(continuityMonthSchema.safeParse({ month: '2026-13' }).success, false);
  assert.equal(continuityMonthSchema.safeParse({ month: '1900-02' }).success, false);
  const now = new Date('2026-10-19T12:00:00Z'), issued = new Date('2026-10-18T12:00:00Z');
  const offline = issueContinuityContext('owner', 'Africa/Cairo', issued);
  const receipt = { context: offline.context, completedAt: '2026-10-18T18:00:00Z' };
  assert.equal(resolveContinuityCompletionDay('owner', 'Africa/Cairo', receipt, now).day, '2026-10-18');
  assert.throws(() => resolveContinuityCompletionDay('other', 'Africa/Cairo', receipt, now));
  assert.throws(() => resolveContinuityCompletionDay('owner', 'Asia/Riyadh', receipt, now));
  assert.throws(() => resolveContinuityCompletionDay('owner', 'Africa/Cairo', { ...receipt, context: receipt.context.slice(1) }, now));
  assert.throws(() => resolveContinuityCompletionDay('owner', 'Africa/Cairo', { ...receipt, completedAt: '2026-10-17T18:00:00Z' }, now));
  assert.throws(() => resolveContinuityCompletionDay('owner', 'Africa/Cairo', { ...receipt, completedAt: '2026-10-20T18:00:00Z' }, now));
  assert.throws(() => resolveContinuityCompletionDay('owner', 'Africa/Cairo', receipt, new Date('2026-10-26T12:00:00Z')));
  assert.equal(continuityDayEndsAt('2026-11-01', 'America/New_York', new Date('2026-11-01T04:00:00Z')).toISOString(), '2026-11-02T05:00:00.000Z');
  assert.equal(continuityDayEndsAt('2026-03-08', 'America/New_York', new Date('2026-03-08T05:00:00Z')).toISOString(), '2026-03-09T04:00:00.000Z');
  for (const timezone of ['Africa/Cairo', 'Asia/Kathmandu', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Australia/Lord_Howe']) {
    const day = localDayKeyForTimezone(timezone, now), end = continuityDayEndsAt(day, timezone, now);
    assert.equal(localDayKeyForTimezone(timezone, new Date(end.getTime() - 1)), day);
    assert.ok(localDayKeyForTimezone(timezone, end) > day);
    const due = new Date(end.getTime() - 120 * 60000);
    assert.equal(evaluateContinuityReminder(due, timezone, 120).eligible, true);
    assert.equal(evaluateContinuityReminder(new Date(due.getTime() - 1), timezone, 120).eligible, false);
    assert.equal(evaluateContinuityReminder(new Date(due.getTime() + 10 * 60000), timezone, 120).eligible, false);
  }
  const spec = getSwaggerSpec(); assert.ok(spec.paths['/continuity']);
  assert.ok(spec.components.schemas.ReadingConfirmationInput.properties.continuity);
  assert.ok(!spec.components.schemas.ReadingConfirmationInput.required.includes('continuity'));
  console.log('Continuity unit checks passed: no premature midnight reset, gap reset, retained totals/best, leap/year dates, signed offline constraints, global/DST boundaries, opt-in validation and additive OpenAPI.');
  if (process.env.CONTINUITY_TEST_DB !== 'true') return;

  // A unique committed TEST schema allows actual independent-transaction race tests.
  // No public app table is edited. The entire test schema is removed in finally.
  const schema = 'continuity_test_' + randomUUID().replaceAll('-', '');
  // Independent untouched client: transaction proxies must not inherit the mocked
  // singleton raw methods, which would recursively open nested transactions.
  const testPrisma = new PrismaClient();
  const originals = { transaction: prisma.$transaction.bind(prisma), query: prisma.$queryRaw, execute: prisma.$executeRaw,
    userFind: prisma.user.findUnique, goal: readingGoalReader.get, send: continuityReminderDelivery.send };
  const inSchema = (fn: (tx: any) => Promise<any>) => testPrisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`); return fn(tx);
  }, { timeout: 30000, maxWait: 15000 });
  let schemaCreated = false;
  try {
    await testPrisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); schemaCreated = true;
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe('CREATE TABLE users (id TEXT PRIMARY KEY, timezone TEXT NOT NULL DEFAULT \'Africa/Cairo\', "isActive" BOOLEAN NOT NULL DEFAULT true)');
      await tx.$executeRawUnsafe('CREATE TABLE daily_progress (id TEXT PRIMARY KEY, "userId" TEXT NOT NULL, date DATE NOT NULL, "quranPagesRead" INTEGER NOT NULL DEFAULT 0, "morningAdhkarCompleted" BOOLEAN NOT NULL DEFAULT false, "eveningAdhkarCompleted" BOOLEAN NOT NULL DEFAULT false, "adhkarCompleted" BOOLEAN NOT NULL DEFAULT false, "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP, UNIQUE("userId",date))');
      await tx.$executeRawUnsafe('CREATE TABLE reading_units ("userId" TEXT, "editionId" TEXT, "contentVersion" TEXT, scope TEXT, "unitKey" TEXT, "completedOn" DATE, PRIMARY KEY("userId","editionId","contentVersion",scope,"unitKey"))');
      await tx.$executeRawUnsafe('CREATE TABLE reading_operations ("userId" TEXT, "requestKey" TEXT, fingerprint TEXT, result JSONB, PRIMARY KEY("userId","requestKey"))');
      await tx.$executeRawUnsafe('CREATE TABLE khatmah ("userId" TEXT PRIMARY KEY, "totalPagesRead" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3))');
      await tx.$executeRawUnsafe('CREATE TABLE warsh_completions ("cycleId" TEXT, "verseKey" TEXT, "completedOn" DATE, PRIMARY KEY("cycleId","verseKey"))');
      await tx.$executeRawUnsafe('CREATE TABLE dhikr_categories (id TEXT PRIMARY KEY, key TEXT)');
      await tx.$executeRawUnsafe('CREATE TABLE dhikr_items (id TEXT PRIMARY KEY, "categoryId" TEXT, "repeatCount" INTEGER, "orderInCategory" INTEGER)');
      await tx.$executeRawUnsafe('CREATE TABLE daily_dhikr_completions (id TEXT PRIMARY KEY, "userId" TEXT, date DATE, "categoryId" TEXT, "itemId" TEXT, "countDone" INTEGER, "updatedAt" TIMESTAMP(3), UNIQUE("userId",date,"categoryId","itemId"))');
      await tx.$executeRawUnsafe('CREATE TABLE device_tokens ("userId" TEXT)');
      for (const sql of readFileSync('prisma/migrations/20261019090000_noor_continuity/migration.sql', 'utf8').split(';').map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(sql);
      await tx.$executeRaw`INSERT INTO users(id) VALUES ('owner'),('other'),('race'),('reader'),('notify'),('inactive'),('failure'),('fallback'),('bridge')`;
      await tx.$executeRaw`INSERT INTO dhikr_categories(id,key) VALUES ('morning','MORNING'),('evening','EVENING'),('wird','GENERAL_WIRD')`;
      await tx.$executeRaw`INSERT INTO dhikr_items(id,"categoryId","repeatCount","orderInCategory") VALUES ('m1','morning',3,1),('m2','morning',1,2),('e1','evening',2,1),('w1','wird',3,1)`;
      await tx.$executeRaw`INSERT INTO daily_progress(id,"userId",date,"quranPagesRead") VALUES ('history1','owner','2026-10-17',1),('history2','owner','2026-10-18',2),('zero','owner','2026-10-16',0)`;
    });
    (prisma as any).$transaction = (fn: any) => inSchema(fn);
    (prisma as any).$queryRaw = (...args: any[]) => inSchema(tx => tx.$queryRaw(...args));
    (prisma as any).$executeRaw = (...args: any[]) => inSchema(tx => tx.$executeRaw(...args));
    (prisma.user as any).findUnique = async (args: any) => {
      const rows = await inSchema(tx => tx.$queryRaw`SELECT * FROM users WHERE id = ${args.where.id}`); return rows[0] ?? null;
    };
    const summary = await getContinuitySummary('owner', now);
    assert.equal(summary.currentStreak, 2); assert.equal(summary.bestStreak, 2); assert.equal(summary.totalCompletedDays, 2); assert.equal(summary.preferences.remindersEnabled, false);
    assert.equal((await getContinuitySummary('other', now)).totalCompletedDays, 0);
    const target = await getContinuityAdhkarTarget('owner', 'MORNING', now);
    const input = { requestKey: randomUUID(), category: 'MORNING', targetVersion: target.targetVersion,
      items: target.requiredItems.map(i => ({ itemId: i.itemId, countDone: i.repeatCount })) };
    await assert.rejects(completeContinuityAdhkar('owner', { ...input, items: input.items.slice(1) }, now), (e: any) => e.statusCode === 400);
    const saved = await completeContinuityAdhkar('owner', input, now);
    assert.equal(saved.summary.currentStreak, 3); assert.equal(saved.summary.totalCompletedDays, 3);
    assert.deepEqual(await completeContinuityAdhkar('owner', { ...input, items: [...input.items].reverse() }, now), saved);
    await assert.rejects(completeContinuityAdhkar('owner', { ...input, items: input.items.map(i => ({ ...i, countDone: 99 })) }, now), (e: any) => e.statusCode === 409);
    await completeContinuityAdhkar('owner', { ...input, requestKey: randomUUID() }, now);
    assert.equal((await getContinuitySummary('owner', now)).totalCompletedDays, 3);
    const counts = await inSchema(tx => tx.$queryRaw`SELECT "countDone" FROM daily_dhikr_completions WHERE "userId" = 'owner' ORDER BY "itemId"`);
    assert.deepEqual(counts.map((r: any) => r.countDone), [3, 1]);
    const afterGap = await getContinuitySummary('owner', new Date('2026-10-21T12:00:00Z'));
    assert.equal(afterGap.currentStreak, 0); assert.equal(afterGap.bestStreak, 3); assert.equal(afterGap.totalCompletedDays, 3);
    const cal = await getContinuityCalendar('owner', '2026-10', now);
    assert.equal(cal.days.length, 31); assert.equal(cal.days.filter(d => d.completed).length, 3);
    assert.equal((await getContinuityCalendar('owner', '2028-02', now)).days.length, 29);
    const prefs = await Promise.allSettled([
      updateContinuityPreferences('owner', { expectedRevision: 0, remindersEnabled: true }, now),
      updateContinuityPreferences('owner', { expectedRevision: 0, remindersEnabled: false }, now),
    ]);
    assert.equal(prefs.filter(p => p.status === 'fulfilled').length, 1);
    assert.equal(prefs.filter(p => p.status === 'rejected' && p.reason.statusCode === 409).length, 1);
    const raceTarget = await getContinuityAdhkarTarget('race', 'MORNING', now);
    const raceInput = { ...input, targetVersion: raceTarget.targetVersion, requestKey: randomUUID() };
    const races = await Promise.all(Array.from({ length: 4 }, () => completeContinuityAdhkar('race', raceInput, now)));
    assert.ok(races.every(r => r.summary.totalCompletedDays === 1));
    assert.equal((await getContinuitySummary('race', now)).totalCompletedDays, 1);
    const context = await getContinuityOfflineContext('other', issued);
    const offlineResult = await completeContinuityAdhkar('other', { ...input, requestKey: randomUUID(), offline: { context: context.context, completedAt: '2026-10-18T18:00:00Z' } }, now);
    assert.equal(offlineResult.creditedDate, '2026-10-18'); assert.equal(offlineResult.summary.completedToday, false); assert.equal(offlineResult.summary.currentStreak, 1);
    await assert.rejects(completeContinuityAdhkar('race', { ...input, requestKey: randomUUID(), offline: { context: context.context, completedAt: '2026-10-18T18:00:00Z' } }, now), (e: any) => e.statusCode === 409);
    await inSchema(tx => tx.$executeRaw`UPDATE users SET timezone = 'Pacific/Kiritimati' WHERE id = 'other'`);
    assert.equal((await getContinuitySummary('other', now)).timezone, 'Africa/Cairo');
    const bridgeContext = await getContinuityOfflineContext('bridge', issued);
    await assert.rejects(inSchema(tx => prepareReadingContinuity(tx, 'bridge', '2026-10-19', { context: bridgeContext.context, completedAt: '2026-10-18T18:00:00Z' }, now, { originalDayOnly: true })), (e: any) => e.statusCode === 409);
    await assert.rejects(inSchema(tx => prepareReadingContinuity(tx, 'bridge', '2026-10-19', { context: bridgeContext.context, completedAt: '2026-10-18T18:00:00Z' }, now,
      { offeredAt: new Date('2026-10-19T10:00:00Z') })), (e: any) => e.statusCode === 409);
    await inSchema(async tx => { await creditContinuityDay(tx, 'bridge', '2026-10-17', 'QURAN'); await creditContinuityDay(tx, 'bridge', '2026-10-19', 'QURAN'); });
    assert.equal((await getContinuitySummary('bridge', now)).currentStreak, 1);
    const bridged = await completeContinuityAdhkar('bridge', { ...input, requestKey: randomUUID(), offline: { context: bridgeContext.context, completedAt: '2026-10-18T18:00:00Z' } }, now);
    assert.equal(bridged.summary.currentStreak, 3); assert.equal(bridged.summary.bestStreak, 3);
    await inSchema(tx => tx.$executeRaw`DELETE FROM dhikr_items WHERE "categoryId" = 'evening'`);
    const fallbackTarget = await getContinuityAdhkarTarget('fallback', 'EVENING', now);
    assert.equal(fallbackTarget.progressMode, 'FALLBACK_CONTINUITY_ONLY');
    const fallbackResult = await completeContinuityAdhkar('fallback', { requestKey: randomUUID(), category: 'EVENING', targetVersion: fallbackTarget.targetVersion,
      items: fallbackTarget.requiredItems.map(i => ({ itemId: i.itemId, countDone: i.repeatCount })) }, now);
    assert.equal(fallbackResult.globalAdhkarCredit, false); assert.equal(fallbackResult.summary.currentStreak, 1);

    // Canonical reading integration: actual ledger inserts and durable request replay.
    const liveNow = new Date(), liveDay = localDayKeyForTimezone('Africa/Cairo', liveNow);
    readingGoalReader.get = async () => ({ available: true, editionId: 'indopak-hafs', contentVersion: 'test-content', plan: null, date: liveDay, source: 'EDITION_PLAN', unit: 'PAGE' }) as any;
    const read = readingConfirmationSchema.parse({ editionId: 'indopak-hafs', contentVersion: 'test-content', expectedPlanId: null, date: liveDay, unitKeys: ['1'], requestKey: randomUUID() });
    assert.equal((await confirmReadingUnits('reader', read)).addedUnits, 1);
    assert.equal((await confirmReadingUnits('reader', read)).addedUnits, 1);
    assert.equal((await confirmReadingUnits('reader', { ...read, requestKey: randomUUID() })).addedUnits, 0);
    assert.equal((await getContinuitySummary('reader')).totalCompletedDays, 1);
    // A failed downstream operation rolls back both page credit and continuity credit.
    const sentinel = new Error('TEST_ROLLBACK');
    await assert.rejects(inSchema(async tx => {
      await creditReadingUnits(tx, 'failure', { editionId: 'indopak-hafs', contentVersion: 'v', scope: 'free:' + liveDay, day: new Date(liveDay + 'T00:00:00Z'), source: 'EDITION_PLAN' }, ['2']); throw sentinel;
    }), (e: any) => e === sentinel);
    assert.equal((await getContinuitySummary('failure')).totalCompletedDays, 0);

    // Actual independent cron transactions: mock only the external provider (no real push).
    await getContinuitySummary('notify', now); await getContinuitySummary('inactive', now);
    await inSchema(async tx => {
      await creditContinuityDay(tx, 'notify', '2026-10-18', 'QURAN');
      await creditContinuityDay(tx, 'inactive', '2026-10-18', 'QURAN');
      await tx.$executeRaw`UPDATE continuity_preferences SET "remindersEnabled" = true WHERE "userId" IN ('notify','inactive')`;
      await tx.$executeRaw`UPDATE users SET "isActive" = false WHERE id = 'inactive'`;
      await tx.$executeRaw`INSERT INTO device_tokens("userId") VALUES ('notify'),('inactive')`;
    });
    let deliveries = 0;
    continuityReminderDelivery.send = async (_userId, payload) => { deliveries++; assert.equal(payload.nativeSound, null); assert.equal(payload.data?.type, 'CONTINUITY'); return { sent: 1, failed: 0 }; };
    const due = new Date(continuityDayEndsAt(today, 'Africa/Cairo', now).getTime() - 120 * 60000);
    const reminderRuns = await Promise.all([runContinuityReminders(due), runContinuityReminders(due)]);
    assert.equal(reminderRuns.reduce((sum, r) => sum + r.claimed, 0), 1); assert.equal(deliveries, 1);
    assert.equal((await runContinuityReminders(due)).claimed, 0);
    await inSchema(async tx => { await tx.$executeRaw`DELETE FROM continuity_send_logs WHERE "userId" = 'notify'`; await creditContinuityDay(tx, 'notify', today, 'QURAN'); });
    assert.equal((await runContinuityReminders(due)).claimed, 0); assert.equal(deliveries, 1);

    const app = express(); app.use(express.json()); app.use('/continuity', continuityRouter); app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1');
    try {
      await new Promise<void>(resolve => server.once('listening', resolve));
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/continuity`;
      const headers = { Authorization: 'Bearer ' + generateAccessToken({ userId: 'owner', email: 'test@example.invalid' }), 'Content-Type': 'application/json' };
      assert.equal((await fetch(url)).status, 401);
      const response = await fetch(url, { headers }); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal((await response.json() as any).data.totalCompletedDays, 3);
      assert.equal((await fetch(url + '/calendar?month=2026-13', { headers })).status, 400);
      assert.equal((await fetch(url + '/preferences', { method: 'PATCH', headers, body: JSON.stringify({ expectedRevision: 0, remindersEnabled: true }) })).status, 409);
      const share: any = await (await fetch(url + '/share', { headers })).json(); assert.equal(share.data.includesWorshipDetails, false);
    } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
    await inSchema(tx => tx.$executeRaw`DELETE FROM users WHERE id = 'owner'`);
    for (const table of ['continuity_days', 'continuity_preferences', 'continuity_operations', 'continuity_send_logs']) {
      const rows = await inSchema(tx => tx.$queryRawUnsafe(`SELECT count(*)::int n FROM "${table}" WHERE "userId" = 'owner'`)); assert.equal(rows[0].n, 0);
    }
    console.log('Continuity DB/HTTP integration passed: actual migration, import, atomic page credit, durable replay, real multi-transaction preference/completion/cron races, offline day preservation, immutable timezone, gap retention, month bounds, silent opt-in push suppression, auth/private envelopes and account cascade.');
  } finally {
    (prisma as any).$transaction = originals.transaction; (prisma as any).$queryRaw = originals.query; (prisma as any).$executeRaw = originals.execute;
    (prisma.user as any).findUnique = originals.userFind; readingGoalReader.get = originals.goal; continuityReminderDelivery.send = originals.send;
    if (schemaCreated) {
      if (!/^continuity_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe test schema name');
      await testPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await testPrisma.$disconnect(); await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

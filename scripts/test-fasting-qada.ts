import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { prisma } from '../src/lib/prisma';
import { hijriOfDayKey, qadaFastingBlockReason, ramadanStartDayKey } from '../src/shared/utils/hijri';
import {
  addQadaAdjustment, addQadaFidya, computeQadaSummary, deleteQadaEvent, estimateQada, estimateQadaDays, evaluateQadaReminder,
  getQadaSummary, listQadaEvents, markMadeUpDay, markRamadanDayMissed, qadaPreferencesPatchSchema, qadaReminderDelivery,
  resetQada, runFastingQadaReminders, unmarkMadeUpDay, unmarkRamadanDayMissed, updateQadaPreferences, type QadaEventRow,
} from '../src/services/fasting-qada.service';
import {
  effectiveEnd, endPrayerExcuse, excusedDaysIn, getExcusedDayKeys, getPrayerExcuse, mutedPrayerReminderUserIds,
  startPrayerExcuse, updatePrayerExcuse, deletePrayerExcusePeriod,
} from '../src/services/prayer-excuse.service';
import { continuityReminderCopy } from '../src/services/continuity-reminder.service';

const prefs = { remindersEnabled: true, reminderTime: '21:00', fastingWeekdays: [1, 4], hijriOffsetDays: 0, revision: 0 };
const ev = (kind: QadaEventRow['kind'], extra: Partial<QadaEventRow>): QadaEventRow =>
  ({ id: randomUUID(), kind, hijriYear: null, ramadanDay: null, date: null, days: 1, source: null, createdAt: new Date(), ...extra });

function pureChecks() {
  // Umm al-Qura calendar anchors.
  assert.equal(ramadanStartDayKey(1447), '2026-02-18');
  assert.equal(ramadanStartDayKey(1448), '2027-02-08');
  assert.equal(ramadanStartDayKey(1449), '2028-01-28');
  assert.equal(ramadanStartDayKey(1448, 1), '2027-02-07', 'positive offset moves the local Hijri date ahead');
  assert.deepEqual(hijriOfDayKey('2027-02-08'), { year: 1448, month: 9, day: 1 });
  assert.equal(qadaFastingBlockReason('2027-03-09'), 'EID_AL_FITR');
  assert.equal(qadaFastingBlockReason('2027-05-16'), 'EID_AL_ADHA');
  assert.equal(qadaFastingBlockReason('2027-05-19'), 'TASHREEQ');
  assert.equal(qadaFastingBlockReason('2027-05-20'), null);
  assert.equal(qadaFastingBlockReason('2027-05-15'), null, 'Arafah may be fasted');
  assert.equal(qadaFastingBlockReason('2027-02-10'), 'RAMADAN');
  assert.equal(qadaFastingBlockReason('2027-02-07'), null);
  assert.equal(qadaFastingBlockReason('2027-02-07', 1), 'RAMADAN');

  // Balance: 7 missed in 1447, 2 made up -> 5 left, due before Ramadan 1448.
  const base = [...Array.from({ length: 7 }, (_, i) => ev('RAMADAN_MISSED', { hijriYear: 1447, ramadanDay: i + 1 })),
    ev('MADE_UP', { date: '2026-10-01' }), ev('MADE_UP', { date: '2026-10-05' })];
  let s = computeQadaSummary(base, prefs, '2026-11-06');
  assert.equal(s.remainingDays, 5);
  assert.equal(s.byYear[0]!.deadline, '2027-02-08');
  assert.equal(s.byYear[0]!.overdue, false);
  assert.equal(s.ramadan.nextRamadanStart, '2027-02-08');
  assert.equal(s.ramadan.daysUntilNextRamadan, 94);
  assert.equal(s.ramadan.latestStartedRamadanYear, 1447);
  assert.ok(s.pace.suggestedDaysPerWeek > 0 && s.pace.suggestedDaysPerWeek < 1);
  assert.equal(s.pace.feasible, true);
  assert.equal(s.notes.delayAr, null);
  assert.equal(s.privacy.reasonStored, false);
  // FIFO: older year paid first; fidya covers days; adjustment can lower but never below zero.
  s = computeQadaSummary([...base, ev('ADJUSTMENT', { hijriYear: 1446, days: 3, source: 'MANUAL' }), ev('FIDYA', { hijriYear: 1446, days: 1 }),
    ev('ADJUSTMENT', { hijriYear: 1440, days: -5, source: 'MANUAL' })], prefs, '2026-11-06');
  const y1446 = s.byYear.find(y => y.hijriYear === 1446)!, y1447 = s.byYear.find(y => y.hijriYear === 1447)!;
  assert.deepEqual([y1446.owedDays, y1446.fidyaDays, y1446.madeUpDays, y1446.remainingDays, y1446.overdue], [3, 1, 2, 0, false]);
  assert.deepEqual([y1447.madeUpDays, y1447.remainingDays], [0, 7]);
  assert.equal(s.byYear.find(y => y.hijriYear === 1440)!.owedDays, 0);
  assert.equal(s.remainingDays, 7);
  // After the next Ramadan starts the old year is overdue and the delay note appears.
  s = computeQadaSummary(base, prefs, '2027-03-20');
  assert.equal(s.byYear[0]!.overdue, true);
  assert.equal(s.overdueDays, 5);
  assert.ok(s.notes.delayAr);
  // Inside Ramadan: no make-up today, no pace.
  s = computeQadaSummary(base, prefs, '2027-02-15');
  assert.equal(s.ramadan.inRamadan, true);
  assert.equal(s.ramadan.ramadanDay, 8);
  assert.equal(s.today.canMakeUp, false);
  assert.equal(s.today.blockedReason, 'RAMADAN');
  assert.equal(s.pace.suggestedDaysPerWeek, 0);
  // Too many days for the time left.
  s = computeQadaSummary([ev('ADJUSTMENT', { hijriYear: 1447, days: 120 })], prefs, '2026-11-06');
  assert.equal(s.pace.feasible, false);
  assert.equal(s.pace.suggestedDaysPerWeek, 7);
  assert.deepEqual(estimateQadaDays(1440, 1447, 6), { years: 8, daysPerYear: 6, estimatedDays: 48, noteAr: estimateQadaDays(1, 1, 1).noteAr });

  // Reminder: evening before a planned weekday only (2026-11-08 is Sunday; Cairo is UTC+2).
  assert.equal(evaluateQadaReminder(new Date('2026-11-08T19:00:00Z'), 'Africa/Cairo', prefs, 5, false).eligible, true);
  assert.equal(evaluateQadaReminder(new Date('2026-11-08T19:00:00Z'), 'Africa/Cairo', prefs, 5, false).fastDate, '2026-11-09');
  assert.equal(evaluateQadaReminder(new Date('2026-11-09T19:00:00Z'), 'Africa/Cairo', prefs, 5, false).eligible, false, 'Tuesday is not planned');
  assert.equal(evaluateQadaReminder(new Date('2026-11-08T18:59:00Z'), 'Africa/Cairo', prefs, 5, false).eligible, false);
  assert.equal(evaluateQadaReminder(new Date('2026-11-08T19:00:00Z'), 'Africa/Cairo', prefs, 0, false).eligible, false, 'nothing owed');
  assert.equal(evaluateQadaReminder(new Date('2026-11-08T19:00:00Z'), 'Africa/Cairo', prefs, 5, true).eligible, false, 'already recorded');
  assert.equal(evaluateQadaReminder(new Date('2026-11-08T19:00:00Z'), 'Africa/Cairo', { ...prefs, remindersEnabled: false }, 5, false).eligible, false);
  // 2027-05-16 (Eid al-Adha) is a Sunday: no reminder on Saturday evening even if Sunday were planned.
  assert.equal(evaluateQadaReminder(new Date('2027-05-15T18:00:00Z'), 'Africa/Cairo', { ...prefs, fastingWeekdays: [0] }, 5, false).eligible, false);
  assert.equal(qadaPreferencesPatchSchema.safeParse({}).success, false);
  assert.equal(qadaPreferencesPatchSchema.safeParse({ fastingWeekdays: [7] }).success, false);
  assert.equal(qadaPreferencesPatchSchema.safeParse({ reason: 'x', remindersEnabled: true }).success, false, 'no reason field is accepted');

  // Excuse mode helpers.
  assert.equal(effectiveEnd({ startDate: '2026-11-01', endDate: null }, '2026-11-06'), '2026-11-06');
  assert.equal(effectiveEnd({ startDate: '2026-11-01', endDate: null }, '2027-01-30'), '2026-12-10', 'open period ends by itself after 40 days');
  assert.deepEqual([...excusedDaysIn([{ startDate: '2026-11-01', endDate: '2026-11-03' }], '2026-11-02', '2026-11-08', '2026-11-08')], ['2026-11-02', '2026-11-03']);

  // Continuity copy names the streak with correct Arabic counting.
  assert.equal(continuityReminderCopy(1).bodyAr, 'خطوة بسيطة اليوم تكمل استمرارك 🌱');
  assert.ok(continuityReminderCopy(2).bodyAr.startsWith('يومان متتاليان'));
  assert.ok(continuityReminderCopy(7).bodyAr.startsWith('٧ أيام متتالية'));
  assert.ok(continuityReminderCopy(30).bodyAr.startsWith('٣٠ يومًا متتاليًا'));
  assert.ok(continuityReminderCopy(100).bodyAr.startsWith('١٠٠ يوم متتالٍ'));
}

async function dbChecks() {
  const original = { tx: prisma.$transaction.bind(prisma), query: prisma.$queryRaw, exec: prisma.$executeRaw, send: qadaReminderDelivery.send };
  const rollback = new Error('FASTING_TEST_ROLLBACK');
  const schema = 'fasting_test_' + randomUUID().replace(/-/g, '');
  try {
    await original.tx(async (tx: any) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe(`CREATE TABLE users(id TEXT PRIMARY KEY, timezone TEXT DEFAULT 'Africa/Cairo', "isActive" BOOLEAN DEFAULT true)`);
      await tx.$executeRawUnsafe(`CREATE TABLE device_tokens("userId" TEXT)`);
      for (const statement of readFileSync('prisma/migrations/20261106090000_fasting_qada_and_prayer_excuse/migration.sql', 'utf8')
        .split(';').map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      await tx.$executeRaw`INSERT INTO users(id) VALUES ('owner'), ('other')`;
      await tx.$executeRaw`INSERT INTO device_tokens("userId") VALUES ('owner')`;
      (prisma as any).$transaction = async (fn: any) => fn(tx);
      (prisma as any).$queryRaw = tx.$queryRaw.bind(tx);
      (prisma as any).$executeRaw = tx.$executeRaw.bind(tx);
      const payloads: any[] = [];
      qadaReminderDelivery.send = (async (_id: any, payload: any) => { payloads.push(payload); return { sent: 1, failed: 0 }; }) as any;
      const nov6 = new Date('2026-11-06T10:00:00Z');

      // Ramadan days: idempotent, owner-only, future and not-yet-started years refused.
      for (const d of [3, 4, 5, 5, 6]) await markRamadanDayMissed('owner', 1447, d, nov6);
      assert.equal((await getQadaSummary('owner', nov6)).remainingDays, 4);
      assert.equal((await getQadaSummary('other', nov6)).remainingDays, 0);
      await assert.rejects(markRamadanDayMissed('owner', 1448, 1, nov6), /not started/);
      await assert.rejects(markRamadanDayMissed('owner', 1448, 20, new Date('2027-02-10T10:00:00Z')), /future/);
      await unmarkRamadanDayMissed('owner', 1447, 6, nov6);
      assert.equal((await getQadaSummary('owner', nov6)).remainingDays, 3);

      // Make-up days: forbidden days and future days refused, duplicates ignored.
      await markMadeUpDay('owner', '2026-11-02', nov6);
      await markMadeUpDay('owner', '2026-11-02', nov6);
      await assert.rejects(markMadeUpDay('owner', '2026-11-07', nov6), /before its day/);
      await assert.rejects(markMadeUpDay('owner', '2026-05-27', nov6), /EID_AL_ADHA/);
      await assert.rejects(markMadeUpDay('owner', '2026-03-01', nov6), /RAMADAN/);
      let s = await getQadaSummary('owner', nov6);
      assert.equal(s.remainingDays, 2);
      assert.equal(s.madeUpTotalDays, 1);
      await unmarkMadeUpDay('owner', '2026-11-02', nov6);
      assert.equal((await getQadaSummary('owner', nov6)).remainingDays, 3);

      // Adjustments, fidya and estimate with request keys (a retried request never double counts).
      await addQadaAdjustment('owner', { hijriYear: 1446, days: 4, requestKey: 'adjust-0001' }, nov6);
      await addQadaAdjustment('owner', { hijriYear: 1446, days: 4, requestKey: 'adjust-0001' }, nov6);
      await addQadaFidya('owner', { hijriYear: 1446, days: 1, requestKey: 'fidya-00001' }, nov6);
      s = await getQadaSummary('owner', nov6);
      assert.equal(s.remainingDays, 3 + 3);
      const preview = await estimateQada('owner', { fromHijriYear: 1440, toHijriYear: 1442, daysPerYear: 6 }, nov6);
      assert.equal(preview.applied, false);
      assert.equal(preview.estimate.estimatedDays, 18);
      await estimateQada('owner', { fromHijriYear: 1440, toHijriYear: 1442, daysPerYear: 6, apply: true, requestKey: 'estimate-01' }, nov6);
      await estimateQada('owner', { fromHijriYear: 1440, toHijriYear: 1442, daysPerYear: 6, apply: true, requestKey: 'estimate-01' }, nov6);
      s = await getQadaSummary('owner', nov6);
      assert.equal(s.remainingDays, 6 + 18);
      await assert.rejects(estimateQada('owner', { fromHijriYear: 1447, toHijriYear: 1448, daysPerYear: 6 }, nov6), /not started/);
      const history = await listQadaEvents('owner', { limit: '2' });
      assert.equal(history.items.length, 2);
      assert.ok(history.nextBefore);
      const fidyaRow = (await listQadaEvents('owner', { limit: '50' })).items.find((e: any) => e.kind === 'FIDYA')!;
      await deleteQadaEvent('owner', fidyaRow.id, nov6);
      await assert.rejects(deleteQadaEvent('other', (await listQadaEvents('owner', {})).items[0]!.id, nov6), /not found/);
      assert.equal((await getQadaSummary('owner', nov6)).remainingDays, 25);

      // Preferences with optimistic revision.
      let p = await updateQadaPreferences('owner', { remindersEnabled: true }, nov6);
      assert.equal(p.preferences.revision, 1);
      assert.deepEqual(p.preferences.fastingWeekdays, [1, 4]);
      await assert.rejects(updateQadaPreferences('owner', { expectedRevision: 0, reminderTime: '20:30' }, nov6), /another device/);
      p = await updateQadaPreferences('owner', { expectedRevision: 1, reminderTime: '21:00', fastingWeekdays: [4, 1, 1] }, nov6);
      assert.deepEqual(p.preferences.fastingWeekdays, [1, 4]);

      // Reminder: Sunday 21:00 Cairo for Monday, once; neutral copy; nothing for the other user.
      await runFastingQadaReminders(new Date('2026-11-08T18:00:00Z'));
      assert.equal(payloads.length, 0);
      await runFastingQadaReminders(new Date('2026-11-08T19:00:00Z'));
      await runFastingQadaReminders(new Date('2026-11-08T19:05:00Z'));
      assert.equal(payloads.length, 1);
      assert.equal(payloads[0].androidChannelId, 'fasting_reminder_v1');
      assert.equal(payloads[0].data.fastDate, '2026-11-09');
      assert.ok(!/قضاء|حيض|عذر|qada/i.test(payloads[0].body + payloads[0].data.bodyEn), 'reminder text stays neutral');
      // Thursday already recorded as made up: no reminder on Wednesday evening.
      await markMadeUpDay('owner', '2026-11-12', new Date('2026-11-12T10:00:00Z'));
      await runFastingQadaReminders(new Date('2026-11-11T19:00:00Z'));
      assert.equal(payloads.length, 1, 'tomorrow already recorded: no reminder');

      // Reset removes everything.
      await resetQada('owner', nov6);
      s = await getQadaSummary('owner', nov6);
      assert.equal(s.remainingDays, 0);
      assert.equal(s.preferences.remindersEnabled, false);

      // Excuse mode.
      let e = await startPrayerExcuse('owner', { startDate: '2026-11-04' }, nov6);
      assert.equal(e.active, true);
      assert.equal(e.current!.days, 3);
      await assert.rejects(startPrayerExcuse('owner', {}, nov6), /already on/);
      await assert.rejects(startPrayerExcuse('other', { startDate: '2026-10-01' }, nov6), /too far/);
      await assert.rejects(startPrayerExcuse('other', { startDate: '2026-11-07' }, nov6), /future/);
      const excused = await getExcusedDayKeys('owner', '2026-11-01', '2026-11-06', '2026-11-06');
      assert.deepEqual([...excused].sort(), ['2026-11-04', '2026-11-05', '2026-11-06']);
      assert.equal((await mutedPrayerReminderUserIds(['owner', 'other'], nov6)).size, 0);
      e = await updatePrayerExcuse('owner', { muteReminders: true }, nov6);
      assert.equal(e.current!.muteReminders, true);
      assert.deepEqual([...(await mutedPrayerReminderUserIds(['owner', 'other'], nov6))], ['owner']);
      e = await endPrayerExcuse('owner', { endDate: '2026-11-05' }, nov6);
      assert.equal(e.active, false);
      assert.equal(e.recent[0]!.endDate, '2026-11-05');
      assert.equal((await mutedPrayerReminderUserIds(['owner'], nov6)).size, 0);
      await assert.rejects(startPrayerExcuse('owner', { startDate: '2026-11-05' }, nov6), /overlaps/);
      await assert.rejects(endPrayerExcuse('owner', {}, nov6), /not on/);
      // Open period past 40 days ends by itself.
      await startPrayerExcuse('owner', { startDate: '2026-11-06' }, nov6);
      e = await getPrayerExcuse('owner', new Date('2027-01-10T10:00:00Z'));
      assert.equal(e.active, false);
      assert.equal(e.recent[0]!.autoEnded, true);
      assert.equal(e.recent[0]!.effectiveEndDate, '2026-12-15');
      e = await startPrayerExcuse('owner', {}, new Date('2027-01-10T10:00:00Z'));
      assert.equal(e.active, true, 'a new period can start after the automatic end');
      assert.equal(e.recent.find(r => r.startDate === '2026-11-06')!.endDate, '2026-12-15', 'auto-ended period is closed at its cap');
      await deletePrayerExcusePeriod('owner', e.current!.id, new Date('2027-01-10T10:00:00Z'));
      assert.equal((await getPrayerExcuse('owner', new Date('2027-01-10T10:00:00Z'))).active, false);

      // Account deletion cascades.
      await markRamadanDayMissed('owner', 1447, 1, nov6);
      await tx.$executeRaw`DELETE FROM users WHERE id = 'owner'`;
      const left: any[] = await tx.$queryRaw`SELECT (SELECT count(*) FROM fasting_qada_events)::int + (SELECT count(*) FROM prayer_excuse_periods)::int + (SELECT count(*) FROM fasting_qada_send_logs)::int AS n`;
      assert.equal(left[0].n, 0);
      console.log('Fasting qada + excuse mode isolated PostgreSQL checks passed: idempotent Ramadan/make-up marks, forbidden and future days, Ramadan-not-started guard, adjustments/fidya/estimate request keys, FIFO balance, revisions, single neutral reminder, reset, excuse start/end/overlap/backdate/mute/auto-end, owner isolation and deletion cascade. No real push sent; all DB changes rolled back.');
      throw rollback;
    }, { timeout: 90000 });
  } catch (e) {
    if (e !== rollback) throw e;
  } finally {
    (prisma as any).$transaction = original.tx; (prisma as any).$queryRaw = original.query; (prisma as any).$executeRaw = original.exec;
    qadaReminderDelivery.send = original.send;
    await prisma.$disconnect();
  }
}

async function main() {
  pureChecks();
  if (process.env.FASTING_TEST_DB !== 'true') {
    console.log('Fasting qada pure checks passed: Umm al-Qura anchors, forbidden days, FIFO balance, deadlines, pace, reminder decision, excuse helpers, continuity copy. Set FASTING_TEST_DB=true for isolated PostgreSQL checks.');
    return;
  }
  await dbChecks();
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

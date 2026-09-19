/**
 * Salawat eligibility + preference validation (no HTTP).
 * Run: npx tsx scripts/test-salawat-eligibility.ts
 */
import assert from 'node:assert/strict';
import {
  evaluateSalawatEligibility,
  isInQuietHours,
  isWithinActiveWindow,
  getLocalClock,
  occurrenceKey,
  computeMaxPerDay,
  parseHhmm,
  normalizeIntervalMinutes,
  SALAWAT_ALLOWED_INTERVALS,
} from '../src/services/salawat-reminder.service';
import { salawatPreferencesPatchSchema } from '../src/controllers/salawat.controller';
import {
  runPrayerReminderCron,
  runAzanBackupReminders,
} from '../src/services/prayer-reminder.service';

const tzCairo = 'Africa/Cairo';
const tzNy = 'America/New_York';

assert.equal(isInQuietHours(22), true);
assert.equal(isInQuietHours(7), true);
assert.equal(isInQuietHours(8), false);
assert.equal(isInQuietHours(14), false);

assert.equal(isWithinActiveWindow(8 * 60, '08:00', '22:00'), true);
assert.equal(isWithinActiveWindow(21 * 60 + 59, '08:00', '22:00'), true);
assert.equal(isWithinActiveWindow(22 * 60, '08:00', '22:00'), false);
assert.equal(isWithinActiveWindow(7 * 60, '08:00', '22:00'), false);
assert.equal(isWithinActiveWindow(23 * 60, '22:00', '08:00'), true);
assert.equal(isWithinActiveWindow(7 * 60, '22:00', '08:00'), true);
assert.equal(isWithinActiveWindow(12 * 60, '22:00', '08:00'), false);

assert.equal(parseHhmm('08:00')?.total, 480);
assert.equal(parseHhmm('24:00'), null);
assert.equal(parseHhmm('8:00'), null);
assert.equal(parseHhmm('25:00'), null);

assert.deepEqual([...SALAWAT_ALLOWED_INTERVALS], [30, 60, 120, 180]);
assert.equal(normalizeIntervalMinutes(15), 180);
assert.equal(normalizeIntervalMinutes(60), 60);

assert.equal(computeMaxPerDay(180, '08:00', '22:00'), 4);
assert.equal(computeMaxPerDay(30, '08:00', '22:00'), 28);

assert.equal(occurrenceKey('2026-09-19', 8 * 60, 60), occurrenceKey('2026-09-19', 8 * 60 + 59, 60));
assert.notEqual(occurrenceKey('2026-09-19', 8 * 60, 60), occurrenceKey('2026-09-19', 9 * 60, 60));

function findLocalHour(targetHour: number, timeZone: string): Date {
  const base = new Date();
  for (let i = 0; i < 48 * 6; i++) {
    const d = new Date(base.getTime() - i * 10 * 60_000);
    if (getLocalClock(d, timeZone).hour === targetHour) return d;
  }
  throw new Error(`Could not find local hour ${targetHour} in ${timeZone}`);
}

const afternoonCairo = findLocalHour(14, tzCairo);
const nightCairo = findLocalHour(23, tzCairo);
const morningQuietCairo = findLocalHour(7, tzCairo);

assert.equal(
  evaluateSalawatEligibility({
    enabled: false,
    now: afternoonCairo,
    timeZone: tzCairo,
    recentSentAt: [],
    intervalMinutes: 60,
    startTime: '08:00',
    endTime: '22:00',
  }).reason,
  'DISABLED',
);

assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: nightCairo,
    timeZone: tzCairo,
    recentSentAt: [],
    intervalMinutes: 60,
    startTime: '08:00',
    endTime: '22:00',
  }).reason,
  'OUTSIDE_WINDOW',
);

assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: morningQuietCairo,
    timeZone: tzCairo,
    recentSentAt: [],
  }).reason,
  'OUTSIDE_WINDOW',
);

assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: afternoonCairo,
    timeZone: tzCairo,
    recentSentAt: [],
    intervalMinutes: 60,
  }).eligible,
  true,
);

const twentyMinAgo = new Date(afternoonCairo.getTime() - 20 * 60_000);
assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: afternoonCairo,
    timeZone: tzCairo,
    recentSentAt: [twentyMinAgo],
    intervalMinutes: 30,
  }).eligible,
  false,
);
assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: afternoonCairo,
    timeZone: tzCairo,
    recentSentAt: [twentyMinAgo],
    intervalMinutes: 30,
  }).reason,
  'TOO_SOON',
);

const fortyMinAgo = new Date(afternoonCairo.getTime() - 40 * 60_000);
assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: afternoonCairo,
    timeZone: tzCairo,
    recentSentAt: [fortyMinAgo],
    intervalMinutes: 30,
  }).eligible,
  true,
);

for (const interval of [30, 60, 120, 180] as const) {
  const ok = evaluateSalawatEligibility({
    enabled: true,
    now: afternoonCairo,
    timeZone: tzCairo,
    recentSentAt: [],
    intervalMinutes: interval,
  });
  assert.equal(ok.eligible, true, `interval ${interval} should be eligible in window`);
}

const nyAfternoon = findLocalHour(14, tzNy);
const nyNight = findLocalHour(23, tzNy);
assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: nyAfternoon,
    timeZone: tzNy,
    recentSentAt: [],
    intervalMinutes: 60,
    startTime: '08:00',
    endTime: '22:00',
  }).eligible,
  true,
);
assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: nyNight,
    timeZone: tzNy,
    recentSentAt: [],
    intervalMinutes: 60,
    startTime: '08:00',
    endTime: '22:00',
  }).reason,
  'OUTSIDE_WINDOW',
);

assert.equal(salawatPreferencesPatchSchema.safeParse({ enabled: true }).success, true);
assert.equal(salawatPreferencesPatchSchema.safeParse({ enabled: false }).success, true);
assert.equal(salawatPreferencesPatchSchema.safeParse({ intervalMinutes: 30 }).success, true);
assert.equal(salawatPreferencesPatchSchema.safeParse({ intervalMinutes: 60 }).success, true);
assert.equal(salawatPreferencesPatchSchema.safeParse({ intervalMinutes: 120 }).success, true);
assert.equal(salawatPreferencesPatchSchema.safeParse({ intervalMinutes: 180 }).success, true);
assert.equal(salawatPreferencesPatchSchema.safeParse({ intervalMinutes: 15 }).success, false);
assert.equal(salawatPreferencesPatchSchema.safeParse({ intervalMinutes: 7 }).success, false);
assert.equal(salawatPreferencesPatchSchema.safeParse({ startTime: '08:00', endTime: '22:00' }).success, true);
assert.equal(salawatPreferencesPatchSchema.safeParse({ windowStart: '08:00', windowEnd: '22:00' }).success, true);
assert.equal(salawatPreferencesPatchSchema.safeParse({ startTime: '22:00', endTime: '08:00' }).success, true);
assert.equal(salawatPreferencesPatchSchema.safeParse({ startTime: '25:00' }).success, false);
assert.equal(salawatPreferencesPatchSchema.safeParse({ endTime: '9:00' }).success, false);
assert.equal(salawatPreferencesPatchSchema.safeParse({}).success, false);
assert.equal(salawatPreferencesPatchSchema.safeParse({ enabled: 'yes' }).success, false);
assert.equal(salawatPreferencesPatchSchema.safeParse({ audioClipId: 'calm_chime' }).success, true);
assert.equal(salawatPreferencesPatchSchema.safeParse({ audioClipId: 'nope' }).success, false);

assert.equal(typeof runPrayerReminderCron, 'function');
assert.equal(typeof runAzanBackupReminders, 'function');

console.log('salawat eligibility + preference validation: OK');

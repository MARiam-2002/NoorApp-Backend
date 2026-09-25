/**
 * Mulk eligibility + preference validation (no HTTP / no DB).
 * Run: npx tsx scripts/test-mulk-eligibility.ts
 */
import assert from 'node:assert/strict';
import {
  evaluateMulkEligibility,
  occurrenceKey,
  MULK_DEFAULT_TIME,
  MULK_SURAH_ID,
  MULK_WINDOW_MINUTES,
} from '../src/services/mulk-reminder.service';
import { getLocalClock, parseHhmm } from '../src/services/salawat-reminder.service';
import { mulkPreferencesPatchSchema } from '../src/controllers/mulk.controller';

const tzCairo = 'Africa/Cairo';
const tzNy = 'America/New_York';

assert.equal(MULK_DEFAULT_TIME, '20:00');
assert.equal(MULK_SURAH_ID, 67);
assert.equal(MULK_WINDOW_MINUTES, 12);
assert.equal(occurrenceKey('2026-09-26', '20:00'), '2026-09-26|MULK|20:00');

/** Find a recent instant whose local clock is within ±window of target HH:mm. */
function findNearLocalTime(targetHhmm: string, timeZone: string, window = 12): Date {
  const target = parseHhmm(targetHhmm)?.total;
  if (target == null) throw new Error(`bad target ${targetHhmm}`);
  const base = new Date();
  for (let i = 0; i < 48 * 6; i++) {
    const d = new Date(base.getTime() - i * 10 * 60_000);
    const clock = getLocalClock(d, timeZone);
    const now = clock.hour * 60 + clock.minute;
    if (Math.abs(now - target) <= window) return d;
  }
  throw new Error(`Could not find local ~${targetHhmm} (±${window}) in ${timeZone}`);
}

function findFarFromLocalTime(targetHhmm: string, timeZone: string, minDistance = 60): Date {
  const target = parseHhmm(targetHhmm)?.total;
  if (target == null) throw new Error(`bad target ${targetHhmm}`);
  const base = new Date();
  for (let i = 0; i < 48 * 6; i++) {
    const d = new Date(base.getTime() - i * 10 * 60_000);
    const clock = getLocalClock(d, timeZone);
    const now = clock.hour * 60 + clock.minute;
    if (Math.abs(now - target) >= minDistance) return d;
  }
  throw new Error(`Could not find local far from ${targetHhmm} in ${timeZone}`);
}

const atEightCairo = findNearLocalTime('20:00', tzCairo);
const afternoonCairo = findFarFromLocalTime('20:00', tzCairo, 60);
const atEightNy = findNearLocalTime('20:00', tzNy);

assert.equal(
  evaluateMulkEligibility({
    enabled: false,
    now: atEightCairo,
    timeZone: tzCairo,
  }).reason,
  'DISABLED',
);

assert.equal(
  evaluateMulkEligibility({
    enabled: true,
    now: afternoonCairo,
    timeZone: tzCairo,
  }).reason,
  'OUTSIDE_WINDOW',
);

const okCairo = evaluateMulkEligibility({
  enabled: true,
  now: atEightCairo,
  timeZone: tzCairo,
});
assert.equal(okCairo.eligible, true);
assert.equal(okCairo.reason, 'OK');
assert.ok(okCairo.occurrenceKey?.endsWith('|MULK|20:00'));

const okNy = evaluateMulkEligibility({
  enabled: true,
  now: atEightNy,
  timeZone: tzNy,
});
assert.equal(okNy.eligible, true);

const nearCustom = findNearLocalTime('21:30', tzCairo);
const customOk = evaluateMulkEligibility({
  enabled: true,
  now: nearCustom,
  timeZone: tzCairo,
  reminderTime: '21:30',
  windowMinutes: 12,
});
assert.equal(customOk.eligible, true);
assert.ok(customOk.occurrenceKey?.includes('|MULK|21:30'));

assert.equal(mulkPreferencesPatchSchema.safeParse({ enabled: true }).success, true);
assert.equal(mulkPreferencesPatchSchema.safeParse({ enabled: false }).success, true);
assert.equal(mulkPreferencesPatchSchema.safeParse({ time: '20:00' }).success, true);
assert.equal(mulkPreferencesPatchSchema.safeParse({ time: '08:30' }).success, true);
assert.equal(mulkPreferencesPatchSchema.safeParse({ enabled: true, time: '20:00' }).success, true);
assert.equal(mulkPreferencesPatchSchema.safeParse({ time: '25:00' }).success, false);
assert.equal(mulkPreferencesPatchSchema.safeParse({ time: '8:00' }).success, false);
assert.equal(mulkPreferencesPatchSchema.safeParse({}).success, false);
assert.equal(mulkPreferencesPatchSchema.safeParse({ enabled: 'yes' }).success, false);

console.log('mulk eligibility + preference validation: OK');

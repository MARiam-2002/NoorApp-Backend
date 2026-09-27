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
assert.equal(MULK_WINDOW_MINUTES, 10);
assert.equal(occurrenceKey('2026-09-26', '20:00'), '2026-09-26|MULK|20:00');

// Cairo is UTC+3 and New York UTC-4 on these dates.
const atEightCairo = new Date('2026-09-26T17:00:20.000Z');
const afternoonCairo = new Date('2026-09-26T12:00:00.000Z');
const atEightNy = new Date('2026-09-27T00:00:20.000Z');
assert.equal(getLocalClock(atEightCairo, tzCairo).hour, 20);
assert.equal(getLocalClock(atEightNy, tzNy).hour, 20);
assert.equal(parseHhmm('20:00')?.total, 20 * 60);

console.log('--- never early, bounded late ---');
for (const [offsetMin, want] of [
  [-12, false],
  [-1, false],
  [0, true],
  [5, true],
  [10, true],
  [11, false],
] as const) {
  const d = new Date(atEightCairo.getTime() + offsetMin * 60_000);
  assert.equal(
    evaluateMulkEligibility({ enabled: true, now: d, timeZone: tzCairo }).eligible,
    want,
    `offset ${offsetMin}m`,
  );
}

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

const nearCustom = new Date('2026-09-26T18:30:30.000Z');
const customOk = evaluateMulkEligibility({
  enabled: true,
  now: nearCustom,
  timeZone: tzCairo,
  reminderTime: '21:30',
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

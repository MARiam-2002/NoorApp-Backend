/**
 * Unit checks for Salawat eligibility (no DB).
 * Run: npx tsx scripts/test-salawat-eligibility.ts
 */
import assert from 'node:assert/strict';
import {
  evaluateSalawatEligibility,
  isInQuietHours,
  getLocalClock,
  SALAWAT_INTERVAL_HOURS,
  SALAWAT_MAX_PER_DAY,
} from '../src/services/salawat-reminder.service';

const tz = 'Africa/Cairo';

assert.equal(isInQuietHours(22), true);
assert.equal(isInQuietHours(23), true);
assert.equal(isInQuietHours(0), true);
assert.equal(isInQuietHours(7), true);
assert.equal(isInQuietHours(8), false);
assert.equal(isInQuietHours(14), false);
assert.equal(isInQuietHours(21), false);

// Build a "now" that is 14:00 local Cairo by searching nearby UTC instants
function findLocalHour(targetHour: number): Date {
  const base = new Date();
  for (let i = 0; i < 48 * 6; i++) {
    const d = new Date(base.getTime() - i * 10 * 60_000);
    if (getLocalClock(d, tz).hour === targetHour) return d;
  }
  throw new Error(`Could not find local hour ${targetHour}`);
}

const afternoon = findLocalHour(14);
const night = findLocalHour(23);
const morningQuiet = findLocalHour(7);

assert.equal(
  evaluateSalawatEligibility({
    enabled: false,
    now: afternoon,
    timeZone: tz,
    recentSentAt: [],
  }).reason,
  'DISABLED',
);

assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: night,
    timeZone: tz,
    recentSentAt: [],
  }).reason,
  'QUIET_HOURS',
);

assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: morningQuiet,
    timeZone: tz,
    recentSentAt: [],
  }).reason,
  'QUIET_HOURS',
);

assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: afternoon,
    timeZone: tz,
    recentSentAt: [],
  }).eligible,
  true,
);

const twoHoursAgo = new Date(afternoon.getTime() - 2 * 60 * 60 * 1000);
assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: afternoon,
    timeZone: tz,
    recentSentAt: [twoHoursAgo],
  }).reason,
  'TOO_SOON',
);

const fourHoursAgo = new Date(afternoon.getTime() - (SALAWAT_INTERVAL_HOURS + 1) * 60 * 60 * 1000);
assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: afternoon,
    timeZone: tz,
    recentSentAt: [fourHoursAgo],
  }).eligible,
  true,
);

const dayKey = getLocalClock(afternoon, tz).dayKey;
const fiveToday = Array.from({ length: SALAWAT_MAX_PER_DAY }, (_, i) => {
  // Space within same local day afternoon window
  return new Date(afternoon.getTime() - (i + 1) * 3 * 60 * 60 * 1000);
}).filter((d) => getLocalClock(d, tz).dayKey === dayKey);

// If filter dropped some due to day boundary, pad with afternoon - minutes
while (fiveToday.length < SALAWAT_MAX_PER_DAY) {
  fiveToday.push(new Date(afternoon.getTime() - fiveToday.length * 60_000));
}

assert.equal(
  evaluateSalawatEligibility({
    enabled: true,
    now: afternoon,
    timeZone: tz,
    recentSentAt: fiveToday.slice(0, SALAWAT_MAX_PER_DAY),
  }).reason,
  'MAX_PER_DAY',
);

// Azan cron still exports the combined entrypoint + azan-only helper
import {
  runPrayerReminderCron,
  runAzanBackupReminders,
} from '../src/services/prayer-reminder.service';

assert.equal(typeof runPrayerReminderCron, 'function');
assert.equal(typeof runAzanBackupReminders, 'function');

console.log('salawat eligibility + azan cron exports: OK');

/**
 * User-local calendar day (worldwide midnight).
 * Run: npx tsx scripts/test-user-local-date.ts
 */
import assert from 'node:assert/strict';
import {
  dateOnlyFromDayKey,
  localDayKeyForTimezone,
} from '../src/shared/utils/user-local-date';

assert.equal(dateOnlyFromDayKey('2026-09-26').toISOString().slice(0, 10), '2026-09-26');

// Same UTC instant can be different local calendar days
const utcEvening = new Date('2026-09-26T22:30:00.000Z'); // ~01:30 next day in Tokyo / still 26th in NY afternoon
const cairo = localDayKeyForTimezone('Africa/Cairo', utcEvening);
const tokyo = localDayKeyForTimezone('Asia/Tokyo', utcEvening);
const la = localDayKeyForTimezone('America/Los_Angeles', utcEvening);

assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(cairo));
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(tokyo));
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(la));
// Tokyo is ahead of Cairo for this instant
assert.notEqual(tokyo, la);

console.log('user-local-date: OK', { cairo, tokyo, la });

/**
 * Khatmah plan math (no HTTP).
 * Run: npx tsx scripts/test-khatmah-plan-math.ts
 */
import assert from 'node:assert/strict';
import {
  computeDailyWardFromDuration,
  computeDailyWardFromJuzPerMonth,
  computeDurationFromJuzPerMonth,
  TOTAL_QURAN_PAGES,
} from '../src/services/khatmah-plan.service';

assert.equal(TOTAL_QURAN_PAGES, 604);
assert.equal(computeDailyWardFromDuration(15), Math.ceil(604 / 15));
assert.equal(computeDailyWardFromDuration(30), Math.ceil(604 / 30));
assert.ok(computeDailyWardFromJuzPerMonth(30) >= 1);
assert.ok(computeDurationFromJuzPerMonth(30) >= 1);
assert.ok(computeDailyWardFromJuzPerMonth(15) <= computeDailyWardFromJuzPerMonth(30));

console.log('khatmah plan math: OK');

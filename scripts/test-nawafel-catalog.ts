/**
 * Nawafel catalog invariants (no HTTP / no DB).
 * Run: npx tsx scripts/test-nawafel-catalog.ts
 */
import assert from 'node:assert/strict';
import {
  NAWAFEL_CATALOG,
  NAWAFEL_KEYS,
  NAWAFEL_SLOT_COUNT,
  NAWAFEL_TOTAL_RAKAHS,
  isNawafelKey,
  getNawafelByKey,
} from '../src/shared/constants/nawafel';

assert.equal(NAWAFEL_SLOT_COUNT, 5);
assert.equal(NAWAFEL_TOTAL_RAKAHS, 12);
assert.equal(NAWAFEL_KEYS.length, 5);
assert.equal(
  NAWAFEL_CATALOG.reduce((s, i) => s + i.rakahs, 0),
  12,
);

assert.equal(isNawafelKey('FAJR_BEFORE_2'), true);
assert.equal(isNawafelKey('ASR_BEFORE_2'), false);
assert.equal(getNawafelByKey('DHUHR_BEFORE_4')?.rakahs, 4);
assert.equal(getNawafelByKey('ISHA_AFTER_2')?.linkedPrayer, 'ISHA');

const orders = NAWAFEL_CATALOG.map((i) => i.sortOrder);
assert.deepEqual(orders, [1, 2, 3, 4, 5]);

console.log('nawafel catalog: OK');

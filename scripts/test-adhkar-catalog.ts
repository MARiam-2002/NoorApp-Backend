/**
 * Offline checks for the reviewed adhkar catalog (no DB).
 * Run: npx tsx scripts/test-adhkar-catalog.ts
 */
import assert from 'node:assert/strict';
import {
  ADHKAR_CATALOG_ITEMS,
  ADHKAR_CATALOG_TOTAL_ITEMS,
  type AdhkarCategoryKey,
} from '../src/shared/data/adhkar-catalog';
import { ADHKAR_STATIC_CATALOG_VERSION } from '../src/shared/constants/static-catalog';
import { ADHKAR_CORRECTIONS_2026, textMatchesPrefix } from './lib/adhkar-corrections-2026';

const DAILY_WIRD_ITEM_GOAL = 8;

const EXPECTED_COUNTS: Record<AdhkarCategoryKey, number> = {
  MORNING: 12,
  EVENING: 11,
  BEFORE_SLEEP: 7,
  ENTERING_MOSQUE: 9,
  AFTER_PRAYER: 9,
  GENERAL_WIRD: 8,
  TRAVEL: 5,
  SICK: 7,
  FOOD: 3,
  ISTIKHARA: 1,
  WUDU: 5,
  ISTIGHFAR: 7,
  QAYN: 5,
  MASJID_AFTER_SALAM: 4,
};

const keys = Object.keys(ADHKAR_CATALOG_ITEMS) as AdhkarCategoryKey[];
assert.equal(keys.length, 14);
assert.deepEqual([...keys].sort(), Object.keys(EXPECTED_COUNTS).sort());

let total = 0;
for (const key of keys) {
  const items = ADHKAR_CATALOG_ITEMS[key];
  assert.equal(items.length, EXPECTED_COUNTS[key], `${key} item count`);
  items.forEach((item, idx) => {
    assert.equal(item.orderInCategory, idx + 1, `${key} order is contiguous`);
    assert.ok(item.textAr.trim().length > 0, `${key} #${idx + 1} text`);
    assert.ok(Number.isInteger(item.repeatCount) && item.repeatCount >= 1, `${key} #${idx + 1} repeatCount`);
    assert.ok(typeof item.referenceAr === 'string' && item.referenceAr.trim().length > 0, `${key} #${idx + 1} reference`);
    assert.ok(item.benefitAr === null || item.benefitAr.trim().length > 0, `${key} #${idx + 1} benefit`);
  });
  const texts = items.map((i) => i.textAr);
  assert.equal(new Set(texts).size, texts.length, `${key} has no duplicate texts`);
  total += items.length;
}
assert.equal(total, 93);
assert.equal(ADHKAR_CATALOG_TOTAL_ITEMS, total);
assert.ok(ADHKAR_CATALOG_ITEMS.GENERAL_WIRD.length >= DAILY_WIRD_ITEM_GOAL, 'daily wird goal is reachable');
assert.ok(ADHKAR_STATIC_CATALOG_VERSION >= 2, 'catalog version bumped after the 2026 review');

const removals = ADHKAR_CORRECTIONS_2026.filter((rule) => rule.remove).length;
assert.equal(removals, 22);
assert.equal(total + removals, 115, 'legacy catalog minus reviewed removals');

assert.ok(textMatchesPrefix('لَا إِلَٰهَ إِلَّا اللَّهُ', 'لا إله إلا الله'), 'dagger alef spelling matches');
assert.ok(!textMatchesPrefix('سُبْحَانَ اللَّهِ', 'الحمد لله'));

console.log(`adhkar catalog tests: ALL PASSED (${keys.length} categories, ${total} items)`);

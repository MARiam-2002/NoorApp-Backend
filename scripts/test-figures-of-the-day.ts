/**
 * Offline checks for the Figure of the Day catalog (no DB, no network).
 * Run: npx tsx scripts/test-figures-of-the-day.ts
 * Evidence is re-verified against the local Sahihayn files by `npx tsx scripts/build-figures-of-the-day.ts --check`.
 */
import assert from 'node:assert/strict';
import { FIGURES_CATALOG_VERSION, FIGURES_OF_THE_DAY, FIGURE_SOURCES } from '../src/shared/data/figures-of-the-day';
import {
  getFigureById,
  getFigureIndexForDay,
  getFigureOfTheDay,
  getFigureOfTheDayLite,
  listFigures,
} from '../src/services/figure-of-day.service';
import { CONTENT_CREDITS } from '../src/shared/constants/content-credits';

const ARABIC = /[\u0621-\u064A]/;
const n = FIGURES_OF_THE_DAY.length;

assert.ok(n >= 30, `catalog too small: ${n}`);
assert.ok(Number.isInteger(FIGURES_CATALOG_VERSION) && FIGURES_CATALOG_VERSION >= 1);
assert.ok(FIGURE_SOURCES.length >= 2);

const ids = new Set<string>();
for (const f of FIGURES_OF_THE_DAY) {
  assert.match(f.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad id ${f.id}`);
  assert.ok(!ids.has(f.id), `duplicate id ${f.id}`);
  ids.add(f.id);
  for (const key of ['nameAr', 'honorificAr', 'titleAr', 'summaryAr', 'lessonAr'] as const) {
    assert.ok(ARABIC.test(f[key]), `${f.id}.${key} must be Arabic text`);
  }
  for (const key of ['nameEn', 'titleEn'] as const) {
    assert.ok(f[key].trim().length > 0, `${f.id}.${key} empty`);
  }
  assert.ok(f.storyAr.length >= 2, `${f.id} needs at least 2 story paragraphs`);
  f.storyAr.forEach((p, i) => assert.ok(ARABIC.test(p), `${f.id}.storyAr[${i}] empty`));

  assert.ok(f.evidence.length >= 1, `${f.id} has no evidence`);
  const seen = new Set<string>();
  for (const e of f.evidence) {
    assert.ok(e.collection === 'bukhari' || e.collection === 'muslim', `${f.id} bad collection`);
    assert.ok(Number.isInteger(e.number) && e.number > 0, `${f.id} bad number`);
    assert.ok(ARABIC.test(e.textAr), `${f.id} empty evidence text`);
    assert.equal(e.sourceAr, `${e.collection === 'bukhari' ? 'رواه البخاري' : 'رواه مسلم'} — رقم ${e.number}`);
    const key = `${e.collection}:${e.number}`;
    assert.ok(!seen.has(key), `${f.id} cites ${key} twice`);
    seen.add(key);
  }
}

assert.equal(FIGURES_OF_THE_DAY[0]!.id, 'musab-ibn-umair');
assert.equal(FIGURES_OF_THE_DAY[0]!.titleAr, 'أول سفير في الإسلام');

for (const year of [2026, 2027, 2028]) {
  const window = new Set<number>();
  for (let day = 1; day <= n; day++) window.add(getFigureIndexForDay(day, year));
  assert.equal(window.size, n, `${year}: first ${n} days must show every figure once`);
  for (let day = 1; day <= 366; day++) {
    const idx = getFigureIndexForDay(day, year);
    assert.ok(idx >= 0 && idx < n);
    assert.equal(idx, getFigureIndexForDay(day, year));
    if (day > 1) assert.notEqual(idx, getFigureIndexForDay(day - 1, year), 'consecutive days repeat');
  }
}
assert.notEqual(getFigureIndexForDay(1, 2026), getFigureIndexForDay(1, 2027), 'year offset missing');

const today = getFigureOfTheDay(272, 2026);
assert.equal(today.dayOfYear, 272);
assert.equal(today.catalogVersion, FIGURES_CATALOG_VERSION);
assert.deepEqual(today.sources, FIGURE_SOURCES);
assert.equal(getFigureOfTheDayLite(272, 2026).id, today.id);
assert.deepEqual(Object.keys(getFigureOfTheDayLite(272, 2026)).sort(), [
  'honorificAr',
  'id',
  'nameAr',
  'nameEn',
  'summaryAr',
  'titleAr',
  'titleEn',
]);
assert.throws(() => getFigureOfTheDay(0), /Invalid day of year/);
assert.throws(() => getFigureOfTheDay(367), /Invalid day of year/);
assert.throws(() => getFigureOfTheDay(Number('abc')), /Invalid day of year/);

const list = listFigures();
assert.equal(list.total, n);
assert.equal(list.items.length, n);
assert.ok(list.items.every((i) => !('storyAr' in i) && !('evidence' in i)));

assert.equal(getFigureById('musab-ibn-umair').nameAr, 'مصعب بن عمير');
assert.throws(() => getFigureById('unknown-person'), /Figure not found/);

assert.ok(CONTENT_CREDITS.some((c) => c.key === 'figures'), 'credits must list the figures sources');

const narrations = FIGURES_OF_THE_DAY.reduce((s, f) => s + f.evidence.length, 0);
console.log(`test-figures-of-the-day: OK (${n} figures, ${narrations} narrations, v${FIGURES_CATALOG_VERSION})`);

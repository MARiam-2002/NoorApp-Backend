/**
 * Offline checks for the Figure of the Day catalog (no DB, no network).
 * Run: npx tsx scripts/test-figures-of-the-day.ts
 * Evidence is re-verified against the local Sahihayn files by `npx tsx scripts/build-figures-of-the-day.ts --check`.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findSahihPhrase } from './lib/sahihayn-lookup';
import { FIGURE_DEFINITIONS } from './lib/figures-of-the-day-2026';
import { validateFigureContentPolicy } from './lib/figure-content-policy';
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

assert.ok(n >= 46, `catalog lost a reviewed story: ${n}`);
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
  assert.ok(f.storyAr.length >= 6, `${f.id} needs a developed narrative`);
  assert.ok(f.storyAr.join(' ').split(/\s+/).length >= 230, `${f.id} story regressed to a summary`);
  assert.ok(f.storyAr.at(-1)!.startsWith('للتأمل:'), `${f.id}: separate editorial reflection from the account`);
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
assert.equal(FIGURES_OF_THE_DAY[0]!.titleAr, 'معلّم القرآن الذي سبق إلى المدينة');

// Verify paragraph provenance, the precise local narration variant, and source/catalog drift.
// These checks protect the attribution chain; they do not certify historical interpretation.
type StoryManifest = {
  catalogVersion: number;
  scope: { sectionNameAr: string; allowedCompanionTypes: string[]; sourceCollectionPolicy: string[] };
  editionFiles: Record<string, string>;
  references: Record<string, {
    collection: 'bukhari' | 'muslim'; number: number; editionNumber: number;
    phrase: string; url: string; textSha256: string;
  }>;
  figures: Record<string, {
    companionType: string;
    summaryAr: string;
    paragraphs: { text: string; kind: 'narrative' | 'reflection'; references: string[] }[];
  }>;
};
const manifest = JSON.parse(readFileSync(join(process.cwd(), 'scripts/lib/figure-story-sources-2026.json'), 'utf8')) as StoryManifest;
validateFigureContentPolicy(FIGURE_DEFINITIONS, manifest, FIGURES_CATALOG_VERSION);
const outsideScope = structuredClone(manifest);
outsideScope.figures['musab-ibn-umair']!.companionType = 'tabii';
assert.throws(() => validateFigureContentPolicy(FIGURE_DEFINITIONS, outsideScope, FIGURES_CATALOG_VERSION), /only companions/);
const missingProvenance = structuredClone(manifest);
missingProvenance.figures['umm-sulaym-bint-milhan']!.paragraphs[0]!.references = [];
assert.throws(() => validateFigureContentPolicy(FIGURE_DEFINITIONS, missingProvenance, FIGURES_CATALOG_VERSION), /missing sources/);
const changedNarrative = structuredClone(manifest);
changedNarrative.figures['musab-ibn-umair']!.paragraphs[0]!.text += ' changed';
assert.throws(() => validateFigureContentPolicy(FIGURE_DEFINITIONS, changedNarrative, FIGURES_CATALOG_VERSION), /narrative\/source drift/);
assert.equal(manifest.catalogVersion, FIGURES_CATALOG_VERSION);
assert.deepEqual(Object.keys(manifest.figures).sort(), [...ids].sort(), 'source manifest must cover the exact catalog');
const editions = new Map<string, { hadiths: { hadithnumber: number; text: string }[] }>();
for (const [filename, expected] of Object.entries(manifest.editionFiles)) {
  const raw = readFileSync(join(process.cwd(), 'prisma/data/hadith', filename));
  assert.equal(createHash('sha256').update(raw).digest('hex'), expected, `${filename}: source edition changed; review citations`);
  editions.set(filename, JSON.parse(raw.toString('utf8')));
}
for (const [key, ref] of Object.entries(manifest.references)) {
  assert.match(ref.url, /^https:\/\/sunnah\.com\/(bukhari|muslim):\d+[a-z]?$/);
  const hadith = editions.get(`ara-${ref.collection}.json`)!.hadiths.find(h => h.hadithnumber === ref.editionNumber);
  assert.ok(hadith, `${key}: missing precise edition entry`);
  assert.equal(createHash('sha256').update(hadith.text).digest('hex'), ref.textSha256, `${key}: narration text changed`);
  assert.ok(findSahihPhrase(ref.collection, ref.phrase).some(m => m.number === ref.number), `${key}: anchor/number mismatch`);
}
for (const figure of FIGURES_OF_THE_DAY) {
  const attribution = manifest.figures[figure.id]!;
  assert.equal(figure.summaryAr, attribution.summaryAr, `${figure.id}: summary attribution drift`);
  assert.deepEqual(figure.storyAr, attribution.paragraphs.map(p => p.text), `${figure.id}: narrative attribution drift`);
  for (const [i, para] of attribution.paragraphs.entries()) {
    assert.ok(para.references.length > 0, `${figure.id} paragraph ${i}: missing references`);
    assert.equal(para.kind === 'reflection', para.text.startsWith('للتأمل:'));
    for (const key of para.references) {
      const ref = manifest.references[key];
      assert.ok(ref, `${figure.id}: unknown reference ${key}`);
      assert.ok(figure.evidence.some(e => e.collection === ref.collection && e.number === ref.number), `${figure.id}: reference missing from public evidence`);
    }
  }
}

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

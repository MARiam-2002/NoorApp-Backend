/**
 * Phase 1 + GENERAL_WIRD behavior checks (no Jest).
 * Run: npx tsx scripts/verify-phase1-perf.ts
 *
 * Journey adhkar 50%/100% comes from MORNING/EVENING flags:
 *   progress = ((morning?1:0)+(evening?1:0))/2
 * GENERAL_WIRD (first 8) drives hub progressItems* when DB-backed.
 * Missing DB GENERAL_WIRD restores cosmetic progressItems* (Option 1).
 */
import {
  deriveAdhkarJourneyFlags,
  DAILY_WIRD_ITEM_GOAL,
  getCosmeticWirdProgress,
} from '../src/services/adhkar.service';

let failed = 0;

function assert(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function journeyAdhkarProgressPercent(morning: boolean, evening: boolean): number {
  return Math.round(((morning ? 1 : 0) + (evening ? 1 : 0)) / 2 * 100);
}

// --- Juz grouping semantics (mirrors listJuzSurahs batch logic) ---
function groupJuzAyahs(
  ayahs: Array<{ surahId: number; ayahNumber: number; page: number | null }>,
) {
  type Group = {
    fromAyah: number;
    toAyah: number;
    startPage: number | null;
    endPage: number | null;
    ayahsInJuz: number;
  };
  const groups = new Map<number, Group>();
  const ordered = [...ayahs].sort(
    (a, b) => a.surahId - b.surahId || a.ayahNumber - b.ayahNumber,
  );
  for (const ayah of ordered) {
    const existing = groups.get(ayah.surahId);
    if (!existing) {
      groups.set(ayah.surahId, {
        fromAyah: ayah.ayahNumber,
        toAyah: ayah.ayahNumber,
        startPage: ayah.page,
        endPage: ayah.page,
        ayahsInJuz: 1,
      });
    } else {
      existing.toAyah = ayah.ayahNumber;
      existing.endPage = ayah.page;
      existing.ayahsInJuz += 1;
    }
  }
  return Array.from(groups.keys())
    .sort((a, b) => a - b)
    .map((surahId) => ({ surahId, ...groups.get(surahId)! }));
}

const sample = [
  { surahId: 2, ayahNumber: 142, page: 22 },
  { surahId: 2, ayahNumber: 143, page: 22 },
  { surahId: 2, ayahNumber: 252, page: 41 },
  { surahId: 1, ayahNumber: 1, page: 1 },
  { surahId: 1, ayahNumber: 7, page: 1 },
];
const grouped = groupJuzAyahs(sample);
assert('juz groups ordered by surahId', grouped[0]?.surahId === 1 && grouped[1]?.surahId === 2);
assert('juz from/to ayah for surah 1', grouped[0]?.fromAyah === 1 && grouped[0]?.toAyah === 7);
assert('juz ayah count for surah 2', grouped[1]?.ayahsInJuz === 3);
assert('juz start/end page for surah 2', grouped[1]?.startPage === 22 && grouped[1]?.endPage === 41);

// --- Case 1: DB-backed GENERAL_WIRD = exactly 8 items (real ledger progress) ---
assert('DAILY_WIRD_ITEM_GOAL is 8', DAILY_WIRD_ITEM_GOAL === 8);

const morningItems = [
  { id: 'm1', repeatCount: 1 },
  { id: 'm2', repeatCount: 3 },
];
const eveningItems = [
  { id: 'e1', repeatCount: 1 },
  { id: 'e2', repeatCount: 1 },
];
const wirdItems = Array.from({ length: DAILY_WIRD_ITEM_GOAL }, (_, i) => ({
  id: `w${i + 1}`,
  repeatCount: 1,
}));
assert('wird slice length is 8', wirdItems.length === 8);

const morningOnly = deriveAdhkarJourneyFlags({
  morningItems,
  eveningItems,
  wirdItems,
  morningDoneByItem: new Map([
    ['m1', 1],
    ['m2', 3],
  ]),
  eveningDoneByItem: new Map(),
  wirdDoneByItem: new Map(),
});
assert('DB: morning alone → morning true', morningOnly.morningAdhkarCompleted === true);
assert('DB: morning alone → evening false', morningOnly.eveningAdhkarCompleted === false);
assert('DB: morning alone → adhkarCompleted false', morningOnly.adhkarCompleted === false);
assert(
  'DB: morning alone → Journey 50%',
  journeyAdhkarProgressPercent(
    morningOnly.morningAdhkarCompleted,
    morningOnly.eveningAdhkarCompleted,
  ) === 50,
);
assert('DB: morning alone → real wird progress 0/8', morningOnly.progressItemsDone === 0);

const morningEvening = deriveAdhkarJourneyFlags({
  morningItems,
  eveningItems,
  wirdItems,
  morningDoneByItem: new Map([
    ['m1', 1],
    ['m2', 3],
  ]),
  eveningDoneByItem: new Map([
    ['e1', 1],
    ['e2', 1],
  ]),
  wirdDoneByItem: new Map(),
});
assert('DB: morning+evening → adhkarCompleted true', morningEvening.adhkarCompleted === true);
assert(
  'DB: morning+evening → Journey 100%',
  journeyAdhkarProgressPercent(
    morningEvening.morningAdhkarCompleted,
    morningEvening.eveningAdhkarCompleted,
  ) === 100,
);

const partialWird = deriveAdhkarJourneyFlags({
  morningItems,
  eveningItems,
  wirdItems,
  morningDoneByItem: new Map(),
  eveningDoneByItem: new Map(),
  wirdDoneByItem: new Map([
    ['w1', 1],
    ['w2', 1],
    ['w3', 1],
  ]),
});
assert('DB: partial wird 3/8', partialWird.progressItemsDone === 3);
assert('DB: partial wird percent 38', partialWird.progressPercent === 38);
assert('DB: partial wird → not completed', partialWird.adhkarCompleted === false);

const wirdDoneMap = new Map(wirdItems.map((w) => [w.id, 1] as const));
const wirdOnly = deriveAdhkarJourneyFlags({
  morningItems,
  eveningItems,
  wirdItems,
  morningDoneByItem: new Map(),
  eveningDoneByItem: new Map(),
  wirdDoneByItem: wirdDoneMap,
});
assert('DB: wird 8/8 → adhkarCompleted', wirdOnly.adhkarCompleted === true);
assert(
  'DB: wird 8/8 forces morning+evening flags',
  wirdOnly.morningAdhkarCompleted === true && wirdOnly.eveningAdhkarCompleted === true,
);
assert('DB: wird 8/8 progress 100%', wirdOnly.progressItemsDone === 8 && wirdOnly.progressPercent === 100);
assert(
  'DB: wird 8/8 → Journey 100%',
  journeyAdhkarProgressPercent(
    wirdOnly.morningAdhkarCompleted,
    wirdOnly.eveningAdhkarCompleted,
  ) === 100,
);

// --- Case 2: GENERAL_WIRD missing — restore OLD cosmetic progressItems* ---
const cosmetic = getCosmeticWirdProgress(12); // typical fallback catalog length
assert('cosmetic: progressItemsTotal is min(8, count)', cosmetic.progressItemsTotal === 8);
assert(
  'cosmetic: progressItemsDone in 1..goal',
  cosmetic.progressItemsDone >= 1 && cosmetic.progressItemsDone <= cosmetic.progressItemsTotal,
);
assert(
  'cosmetic: percent matches formula',
  cosmetic.progressPercent ===
    Math.round((cosmetic.progressItemsDone / cosmetic.progressItemsTotal) * 100),
);

// Simulate sync merge: flags from ledger fallback, progress from cosmetic (Option 1)
const missingDbFlags = deriveAdhkarJourneyFlags({
  morningItems,
  eveningItems,
  wirdItems,
  morningDoneByItem: new Map([
    ['m1', 1],
    ['m2', 3],
  ]),
  eveningDoneByItem: new Map(),
  wirdDoneByItem: new Map(), // no wird ledger → wirdDone false
});
const missingDbMerged = {
  ...missingDbFlags,
  ...getCosmeticWirdProgress(12),
};
assert(
  'missing-DB: Journey still 50% from morning flag',
  journeyAdhkarProgressPercent(
    missingDbMerged.morningAdhkarCompleted,
    missingDbMerged.eveningAdhkarCompleted,
  ) === 50,
);
assert('missing-DB: adhkarCompleted still false', missingDbMerged.adhkarCompleted === false);
assert(
  'missing-DB: progressItemsDone is cosmetic (not 0 from empty wird ledger)',
  missingDbMerged.progressItemsDone === cosmetic.progressItemsDone &&
    missingDbMerged.progressItemsDone !== 0,
);
assert(
  'missing-DB: progressItemsTotal/Percent are cosmetic',
  missingDbMerged.progressItemsTotal === cosmetic.progressItemsTotal &&
    missingDbMerged.progressPercent === cosmetic.progressPercent,
);

const missingDbBoth = {
  ...deriveAdhkarJourneyFlags({
    morningItems,
    eveningItems,
    wirdItems,
    morningDoneByItem: new Map([
      ['m1', 1],
      ['m2', 3],
    ]),
    eveningDoneByItem: new Map([
      ['e1', 1],
      ['e2', 1],
    ]),
    wirdDoneByItem: new Map(),
  }),
  ...getCosmeticWirdProgress(12),
};
assert('missing-DB: morning+evening → completed true', missingDbBoth.adhkarCompleted === true);
assert(
  'missing-DB: morning+evening → Journey 100%',
  journeyAdhkarProgressPercent(
    missingDbBoth.morningAdhkarCompleted,
    missingDbBoth.eveningAdhkarCompleted,
  ) === 100,
);
assert(
  'missing-DB: completed true still keeps cosmetic progress fields',
  missingDbBoth.progressItemsDone === cosmetic.progressItemsDone,
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll GENERAL_WIRD Option-1 behavior checks passed.');

/**
 * Noor AI Phase 2.1: fixed evaluation set for deterministic Quran discovery search.
 * Every expected ayah was checked against its canonical text: the query words appear in it.
 * Fails if any expected ayah drops out of its top-k window. Prints recall@k and MRR.
 * Run: npx tsx scripts/test-ai-quran-eval.ts
 */
import assert from 'node:assert/strict';

type EvalCase = { query: string; expected: string[]; k: number };

/** Quoted phrases must rank their source ayah first; topic words must surface their core ayahs. */
const EVAL_SET: EvalCase[] = [
  { query: 'قل هو الله أحد', expected: ['112:1'], k: 1 },
  { query: 'إنا أعطيناك الكوثر', expected: ['108:1'], k: 1 },
  { query: 'اهدنا الصراط المستقيم', expected: ['1:6'], k: 1 },
  { query: 'الحمد لله رب العالمين', expected: ['1:2'], k: 1 },
  { query: 'وما خلقت الجن والإنس إلا ليعبدون', expected: ['51:56'], k: 1 },
  { query: 'إله الناس', expected: ['114:3'], k: 1 },
  { query: 'سلام على إبراهيم', expected: ['37:109'], k: 1 },
  { query: 'الله لا إله إلا هو الحي القيوم', expected: ['2:255', '3:2'], k: 2 },
  { query: 'الحي القيوم', expected: ['2:255', '3:2', '20:111'], k: 3 },
  { query: 'الصبر والصلاة', expected: ['2:45', '2:153'], k: 2 },
  { query: 'ليلة القدر', expected: ['97:1', '97:2', '97:3'], k: 3 },
  { query: 'عيد', expected: ['5:114'], k: 1 },
  { query: 'الربا', expected: ['2:275', '2:276', '2:278', '3:130', '4:161'], k: 5 },
  { query: 'ما حكم الربا', expected: ['2:275', '2:276', '2:278', '3:130', '4:161'], k: 5 },
  { query: 'الصيام', expected: ['2:183', '2:187'], k: 2 },
  { query: 'الكرسي', expected: ['2:255'], k: 2 },
  { query: 'آيات عن الصبر', expected: ['2:45', '2:153'], k: 5 },
  { query: 'الرحمن', expected: ['55:1', '1:3'], k: 3 },
];

const outbound: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  outbound.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  return realFetch(input, init);
}) as typeof fetch;

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const { searchQuran } = await import('../src/services/ai/tools/quran-search.tool');
  try {
    let recallSum = 0;
    let reciprocalRankSum = 0;
    const failures: string[] = [];
    for (const c of EVAL_SET) {
      const ranked = (await searchQuran(c.query, 50)).map((h) => `${h.surahId}:${h.ayahNumber}`);
      const window = ranked.slice(0, c.k);
      const found = c.expected.filter((ref) => window.includes(ref));
      const recall = found.length / c.expected.length;
      const firstRank = ranked.findIndex((ref) => c.expected.includes(ref));
      recallSum += recall;
      reciprocalRankSum += firstRank >= 0 ? 1 / (firstRank + 1) : 0;
      console.log(`${recall === 1 ? 'PASS' : 'FAIL'} recall@${c.k}=${recall.toFixed(2)} "${c.query}" → ${window.join(', ')}`);
      if (recall < 1) failures.push(`"${c.query}": expected ${c.expected.join(', ')} in top ${c.k}, got ${window.join(', ')}`);
    }
    console.log(
      `eval: ${EVAL_SET.length} cases, mean recall@k=${(recallSum / EVAL_SET.length).toFixed(3)}, ` +
        `MRR=${(reciprocalRankSum / EVAL_SET.length).toFixed(3)}`,
    );
    assert.deepEqual(failures, [], failures.join('\n'));
    assert.deepEqual(outbound, [], 'no network calls');
    console.log('ai quran eval: OK');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

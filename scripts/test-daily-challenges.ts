/**
 * Offline checks for the daily challenge bank (no DB, no network).
 * Hadith quotes are verified separately against the Sahihayn files: scripts/verify-challenge-citations.ts
 * Run: npx tsx scripts/test-daily-challenges.ts
 */
import assert from 'node:assert/strict';
import {
  DAILY_CHALLENGE_BANK,
  buildDailyChallengeTemplates,
  getDailyChallengeDefinition,
} from '../src/shared/data/daily-challenges';
import { FALLBACK_CHALLENGE } from '../src/shared/constants/fallbacks';
import { isDailyChallengeCompleted } from '../src/utils/challenge';

const TYPES = ['QURAN_PAGES', 'PRAYER', 'ADHKAR', 'SADAQAH'] as const;
const empty = { quranPagesRead: 0, adhkarCompleted: false, sadaqahAmount: 0 };

assert.equal(DAILY_CHALLENGE_BANK.length, 28);
for (const t of TYPES) {
  assert.equal(DAILY_CHALLENGE_BANK.filter((c) => c.type === t).length, 7, `${t} count`);
}
assert.equal(new Set(DAILY_CHALLENGE_BANK.map((c) => c.titleAr)).size, 28, 'Arabic titles unique');
assert.equal(new Set(DAILY_CHALLENGE_BANK.map((c) => c.titleEn)).size, 28, 'English titles unique');

DAILY_CHALLENGE_BANK.forEach((c, i) => {
  const label = `#${i + 1} ${c.titleEn}`;
  for (const f of ['titleAr', 'titleEn', 'descriptionAr', 'descriptionEn'] as const) {
    assert.ok(c[f].trim().length >= 3, `${label} ${f} empty`);
  }
  assert.match(c.titleAr + c.descriptionAr, /[\u0600-\u06FF]/, `${label} Arabic text`);
  assert.doesNotMatch(c.titleEn + c.descriptionEn, /[\u0621-\u064A]/, `${label} English must not contain Arabic letters`);
  assert.ok(Number.isInteger(c.targetValue) && c.targetValue > 0, `${label} target`);
  assert.ok(c.rewardPoints >= 50 && c.rewardPoints <= 300, `${label} reward`);

  if (c.type === 'PRAYER') assert.equal(c.targetValue, 5, `${label} PRAYER target is the five daily prayers`);
  if (c.type === 'ADHKAR') assert.equal(c.targetValue, 1, `${label} ADHKAR is a boolean check`);
  if (c.type === 'QURAN_PAGES') assert.ok(c.targetValue <= 20, `${label} at most a juz'`);
  if (c.type === 'QURAN_PAGES' || c.type === 'SADAQAH') {
    const n = String(c.targetValue);
    const words: Record<string, [RegExp, RegExp]> = {
      '2': [/صفحتين|صفحتان/, /two/i], '3': [/ثلاث/, /three/i], '4': [/أربع/, /four/i],
      '5': [/خمس|\b5\b/, /five|\b5\b/i], '6': [/ست/, /six/i], '10': [/عشر|10/, /ten|10/i], '20': [/20|جزء/, /20|juz/i],
    };
    const [ar, en] = c.type === 'QURAN_PAGES' ? words[n] ?? [new RegExp(n), new RegExp(n)] : [new RegExp(n), new RegExp(n)];
    assert.match(c.descriptionAr, ar, `${label} Arabic description must state the target ${n}`);
    assert.match(c.descriptionEn, en, `${label} English description must state the target ${n}`);
  }

  const arCite = c.descriptionAr.match(/\(رواه (البخاري|مسلم) — رقم (\d+)\)/);
  const enCite = c.descriptionEn.match(/\(Sahih (al-Bukhari|Muslim) (\d+)\)/);
  assert.equal(!!arCite, !!enCite, `${label} citation must appear in both languages`);
  if (arCite && enCite) {
    assert.equal(arCite[2], enCite[2], `${label} citation numbers differ`);
    assert.equal(arCite[1] === 'البخاري', enCite[1] === 'al-Bukhari', `${label} citation collections differ`);
    assert.ok(/«[^»]+»/.test(c.descriptionAr), `${label} cited hadith must be quoted`);
  }

  assert.equal(isDailyChallengeCompleted(c.type, c.targetValue, empty, []), false, `${label} not done on an empty day`);
  const done = { quranPagesRead: c.targetValue, adhkarCompleted: true, sadaqahAmount: c.targetValue };
  const prayers = ['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA'] as const;
  assert.equal(isDailyChallengeCompleted(c.type, c.targetValue, done, [...prayers]), true, `${label} achievable`);
});

const rows = buildDailyChallengeTemplates();
assert.equal(rows.length, 366);
rows.forEach((r, i) => {
  assert.equal(r.dayOfYear, i + 1);
  assert.equal(r.titleEn, DAILY_CHALLENGE_BANK[i % 28]!.titleEn);
});
assert.equal(getDailyChallengeDefinition(1), DAILY_CHALLENGE_BANK[0]);
assert.equal(getDailyChallengeDefinition(29), DAILY_CHALLENGE_BANK[0]);
assert.equal(getDailyChallengeDefinition(366), DAILY_CHALLENGE_BANK[365 % 28]);
for (let d = 2; d <= 366; d++) {
  assert.notEqual(getDailyChallengeDefinition(d).type, getDailyChallengeDefinition(d - 1).type, `day ${d} repeats type`);
}

const b0 = DAILY_CHALLENGE_BANK[0]!;
assert.deepEqual(
  { ...FALLBACK_CHALLENGE },
  { titleAr: b0.titleAr, titleEn: b0.titleEn, descriptionAr: b0.descriptionAr, descriptionEn: b0.descriptionEn, type: b0.type, targetValue: b0.targetValue, rewardPoints: b0.rewardPoints },
  'FALLBACK_CHALLENGE must equal bank[0]',
);

console.log('test-daily-challenges: OK (28 bilingual measurable challenges, 366-day rotation)');

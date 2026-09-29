/**
 * Verifies every «quote» in the daily challenge bank against the local Sahihayn files
 * (prisma/data/hadith, git-ignored). The quote must occur in the cited narration number.
 * Run: npx tsx scripts/verify-challenge-citations.ts
 */
import { DAILY_CHALLENGE_BANK } from '../src/shared/data/daily-challenges';
import { findSahihPhrase, type SahihCollection } from './lib/sahihayn-lookup';

let failures = 0;
let checked = 0;
for (const c of DAILY_CHALLENGE_BANK) {
  const quote = c.descriptionAr.match(/«([^»]+)»/)?.[1];
  const cite = c.descriptionAr.match(/\(رواه (البخاري|مسلم) — رقم (\d+)\)/);
  if (!quote && !cite) continue;
  if (!quote || !cite) {
    failures++;
    console.log('FAIL  quote without citation (or vice versa):', c.titleAr);
    continue;
  }
  const collection: SahihCollection = cite[1] === 'البخاري' ? 'bukhari' : 'muslim';
  const number = Number(cite[2]);
  const hit = findSahihPhrase(collection, quote).some((m) => m.number === number);
  const enNumber = c.descriptionEn.match(/\(Sahih (al-Bukhari|Muslim) (\d+)\)/);
  const enOk = enNumber && Number(enNumber[2]) === number && (enNumber[1] === 'al-Bukhari') === (collection === 'bukhari');
  checked++;
  if (!hit || !enOk) failures++;
  console.log(`${hit && enOk ? 'PASS' : 'FAIL'}  ${collection} ${number}  ${c.titleAr}${enOk ? '' : '  (English citation mismatch)'}`);
}
console.log(failures ? `\n${failures} FAILED` : `\nAll ${checked} citations verified verbatim.`);
if (failures) process.exit(1);

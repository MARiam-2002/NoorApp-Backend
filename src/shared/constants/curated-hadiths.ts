/**
 * Verified Daily Hadith bank — Sahih al-Bukhari & Sahih Muslim only.
 *
 * Authenticity policy:
 * - Source texts: Arabic editions of Sahih al-Bukhari and Sahih Muslim
 *   (al-Sahihayn). Classical Ahl al-Sunnah consensus treats these two works
 *   as authentic (sahih) collections.
 * - No Tirmidhi / Abu Dawud / unverified web quotes in this bank.
 * - Matn extracted from quoted Arabic prophetic text; duplicates removed.
 *
 * Used for:
 * 1) prisma seed → HadithOfTheDay rows (dayOfYear 1..366)
 * 2) Runtime deterministic selection / fallback
 *
 * Flutter contract fields remain: textAr, sourceAr
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type VerifiedHadith = {
  textAr: string;
  sourceAr: string;
  collection?: 'bukhari' | 'muslim';
  collectionAr?: string;
  hadithNumber?: number | null;
  book?: number | null;
  bookHadith?: number | null;
};

type HadithBankFile = {
  version: number;
  count: number;
  step: number;
  yearStride: number;
  policy?: Record<string, unknown>;
  hadiths: VerifiedHadith[];
};

function resolveBankPath(): string {
  const candidates = [
    join(process.cwd(), 'src/shared/data/verified-sahih-hadith-bank.json'),
    join(process.cwd(), 'dist/shared/data/verified-sahih-hadith-bank.json'),
    join(process.cwd(), 'shared/data/verified-sahih-hadith-bank.json'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    'verified-sahih-hadith-bank.json not found (expected under src/shared/data or dist/shared/data)',
  );
}

function loadBank(): HadithBankFile {
  const raw = readFileSync(resolveBankPath(), 'utf8');
  const parsed = JSON.parse(raw) as HadithBankFile;
  if (!Array.isArray(parsed.hadiths) || parsed.hadiths.length === 0) {
    throw new Error('Verified Sahih hadith bank is empty — refuse to serve unverified fallbacks');
  }
  return parsed;
}

const bank = loadBank();

/** Full verified pool (Bukhari + Muslim matns only). */
export const VERIFIED_SAHIH_HADITHS: VerifiedHadith[] = bank.hadiths;

/** @deprecated Use VERIFIED_SAHIH_HADITHS — kept alias for older imports. */
export const CURATED_HADITHS = VERIFIED_SAHIH_HADITHS;

export const HADITH_BANK_META = {
  version: bank.version,
  count: bank.count,
  step: bank.step,
  yearStride: bank.yearStride,
  collections: ['Sahih al-Bukhari', 'Sahih Muslim'] as const,
  policy: bank.policy ?? null,
};

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Deterministic index into the verified pool for a calendar day.
 * - Stable for the same (dayOfYear, year)
 * - Different dayOfYear → different index (step coprime to pool size)
 * - Year stride walks further through the pool across years
 */
export function getVerifiedHadithIndex(dayOfYear: number, year = new Date().getFullYear()): number {
  const n = VERIFIED_SAHIH_HADITHS.length;
  const step = bank.step || 1;
  const yearStride = bank.yearStride || 17;
  const day = Math.floor(dayOfYear);
  return mod((day - 1) * step + year * yearStride, n);
}

export function getCuratedHadithForDay(
  dayOfYear: number,
  year = new Date().getFullYear(),
): VerifiedHadith {
  const idx = getVerifiedHadithIndex(dayOfYear, year);
  const hit = VERIFIED_SAHIH_HADITHS[idx];
  if (!hit?.textAr?.trim() || !hit.sourceAr?.trim()) {
    const first = VERIFIED_SAHIH_HADITHS[0]!;
    return { textAr: first.textAr, sourceAr: first.sourceAr };
  }
  return { textAr: hit.textAr, sourceAr: hit.sourceAr };
}

export function getHadithBankStats() {
  const bukhari = VERIFIED_SAHIH_HADITHS.filter((h) => h.collection === 'bukhari').length;
  const muslim = VERIFIED_SAHIH_HADITHS.filter((h) => h.collection === 'muslim').length;
  return {
    total: VERIFIED_SAHIH_HADITHS.length,
    bukhari,
    muslim,
    step: bank.step,
    yearStride: bank.yearStride,
  };
}

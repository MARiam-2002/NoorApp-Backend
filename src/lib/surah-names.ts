import { CATALOG_SURAHS } from '../data/surahs';

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;
const LATIN_DIGITS_ONLY = /^\d+$/;

const NAME_EN_OVERRIDES: Record<number, string> = {
  1: 'Al-Fatihah',
  2: 'Al-Baqarah',
  3: "Ali 'Imran",
  4: 'An-Nisa',
  5: "Al-Ma'idah",
  6: "Al-An'am",
  7: "Al-A'raf",
};

function stripPresentationMarks(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\uFEFF/g, '')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/\u0671/g, 'ا')
    .replace(/[\u200B-\u200F\u202A-\u202E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBareSurahId(value: string | null | undefined, surahId?: number): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  const latin = trimmed.replace(ARABIC_INDIC_DIGITS, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    return ch;
  });
  if (LATIN_DIGITS_ONLY.test(latin)) {
    if (surahId == null) return true;
    return Number(latin) === surahId;
  }
  return false;
}

const CANONICAL_AR = new Map<number, string>();
const CANONICAL_EN = new Map<number, string>();

for (const surah of CATALOG_SURAHS) {
  CANONICAL_AR.set(surah.id, stripPresentationMarks(surah.nameAr));
  CANONICAL_EN.set(surah.id, NAME_EN_OVERRIDES[surah.id] ?? surah.nameEn);
}

export function resolveSurahNameAr(surahId: number, nameAr?: string | null): string {
  const canonical = CANONICAL_AR.get(surahId);
  if (isBareSurahId(nameAr, surahId) || !nameAr) {
    return canonical ?? String(nameAr ?? surahId);
  }
  const cleaned = stripPresentationMarks(nameAr);
  return cleaned || canonical || nameAr;
}

export function resolveSurahNameEn(surahId: number, nameEn?: string | null): string {
  const canonical = CANONICAL_EN.get(surahId);
  if (!nameEn || isBareSurahId(nameEn, surahId)) {
    return canonical ?? nameEn ?? String(surahId);
  }
  return nameEn;
}

export function withResolvedSurahNames<
  T extends { id?: number; nameAr?: string | null; nameEn?: string | null },
>(surah: T): T & { nameAr: string; nameEn: string } {
  const id = Number(surah.id);
  return {
    ...surah,
    nameAr: resolveSurahNameAr(id, surah.nameAr),
    nameEn: resolveSurahNameEn(id, surah.nameEn),
  };
}

import { normalizeArabicDigits } from '../../../shared/utils/arabic-normalize';
import { resolveSurahIdByName, type SurahCatalog } from './surah-name-index';

export type QuranReference = {
  surahId: number;
  startAyah: number;
  endAyah: number;
};

export type QuranReferenceFailureReason =
  | 'UNKNOWN_SURAH'
  | 'INVALID_SURAH_NUMBER'
  | 'AYAH_OUT_OF_RANGE'
  | 'INVALID_RANGE'
  | 'RANGE_TOO_LARGE';

export type QuranReferenceParseResult =
  | { kind: 'reference'; reference: QuranReference }
  | { kind: 'invalid'; reason: QuranReferenceFailureReason; message: string }
  | { kind: 'not_reference' };

/** Longest contiguous range returned for one exact reference. */
export const MAX_REFERENCE_RANGE = 50;

const SURAH_PREFIX = /^(?:surah|surat|sura|chapter|سورة|سوره)\s+/u;
const AYAH_WORD = '(?:ayah|ayat|aya|verses|verse|آية|آيه|اية|ايه|الآية|الآيه|الاية|الايه|آيات|ايات)';
const REFERENCE_PATTERN = new RegExp(
  `^(.+?)\\s*(?:[:：/،,]\\s*|\\s+)(?:${AYAH_WORD}\\s*)?(\\d{1,4})(?:\\s*-\\s*(\\d{1,4}))?$`,
  'u',
);

function preprocess(input: string): string {
  return normalizeArabicDigits(input.normalize('NFKC'))
    .toLowerCase()
    .replace(/[\uFEFF\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[﴿﴾()[\]{}«»"“”]/g, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/(\d)\s*(?:إلى|الى|to|through|until)\s*(\d)/gu, '$1-$2')
    .replace(/\s+/g, ' ')
    .trim();
}

function invalid(reason: QuranReferenceFailureReason, message: string): QuranReferenceParseResult {
  return { kind: 'invalid', reason, message };
}

/**
 * Deterministic parser for exact Quran references ("البقرة 255", "2:255-257",
 * "Al-Baqarah 255"). Surah names resolve only through the `surahs` table catalog.
 * Anything that looks like a reference but cannot be resolved exactly is reported
 * as `invalid` — it is never mapped to a nearby or guessed ayah.
 */
export function parseQuranReference(input: string, catalog: SurahCatalog): QuranReferenceParseResult {
  const text = preprocess(input ?? '');
  const match = REFERENCE_PATTERN.exec(text);
  if (!match) return { kind: 'not_reference' };

  const namePart = (match[1] ?? '').replace(SURAH_PREFIX, '').trim();
  const startAyah = Number(match[2]);
  const endAyah = match[3] != null ? Number(match[3]) : startAyah;
  if (!namePart) return { kind: 'not_reference' };

  let surahId: number | null;
  if (/^\d{1,4}$/.test(namePart)) {
    surahId = Number(namePart);
    if (!catalog.byId.has(surahId)) {
      return invalid('INVALID_SURAH_NUMBER', `Surah ${namePart} does not exist (valid range 1-114)`);
    }
  } else {
    surahId = resolveSurahIdByName(catalog, namePart);
    if (surahId == null) {
      return invalid('UNKNOWN_SURAH', `"${namePart}" is not a recognized surah name`);
    }
  }

  const surah = catalog.byId.get(surahId)!;
  if (endAyah < startAyah) {
    return invalid('INVALID_RANGE', `Range ${startAyah}-${endAyah} is reversed`);
  }
  if (startAyah < 1 || endAyah > surah.totalAyahs) {
    return invalid(
      'AYAH_OUT_OF_RANGE',
      `Surah ${surahId} has ${surah.totalAyahs} ayahs; ${startAyah === endAyah ? `ayah ${startAyah}` : `range ${startAyah}-${endAyah}`} does not exist`,
    );
  }
  if (endAyah - startAyah + 1 > MAX_REFERENCE_RANGE) {
    return invalid('RANGE_TOO_LARGE', `A range may contain at most ${MAX_REFERENCE_RANGE} ayahs`);
  }

  return { kind: 'reference', reference: { surahId, startAyah, endAyah } };
}

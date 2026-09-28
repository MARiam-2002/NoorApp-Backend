import { prisma } from '../../../lib/prisma';
import { resolveSurahNameAr } from '../../../lib/surah-names';
import { stripSurahOpeningBismillahIfNeeded } from '../../quran.service';
import { MAX_REFERENCE_RANGE, type QuranReference } from '../intent/quran-reference-parser';

export type QuranAyahRecord = {
  surahId: number;
  ayahNumber: number;
  surahNameAr: string;
  /** Canonical `Ayah.textAr` with only the existing display sanitation (BOM + opening Bismillah on ayah 1). */
  text: string;
  page: number | null;
  juz: number | null;
};

export type QuranLookupResult =
  | { ok: true; ayahs: QuranAyahRecord[] }
  | { ok: false; reason: 'INVALID_REFERENCE' | 'AYAH_NOT_FOUND'; message: string };

export function isWellFormedReference(ref: QuranReference): boolean {
  return (
    Number.isInteger(ref.surahId) &&
    Number.isInteger(ref.startAyah) &&
    Number.isInteger(ref.endAyah) &&
    ref.surahId >= 1 &&
    ref.startAyah >= 1 &&
    ref.endAyah >= ref.startAyah &&
    ref.endAyah - ref.startAyah + 1 <= MAX_REFERENCE_RANGE
  );
}

/** Same display text the existing Quran endpoints return for this ayah. */
export function toDisplayAyahText(row: { surahId: number; ayahNumber: number; textAr: string }): string {
  return stripSurahOpeningBismillahIfNeeded(row);
}

/**
 * Exact ayah or contiguous range from the `ayahs` table. All-or-nothing: if any
 * requested ayah is missing the whole lookup fails (no partial results).
 */
export async function lookupQuranAyahs(ref: QuranReference): Promise<QuranLookupResult> {
  if (!isWellFormedReference(ref)) {
    return { ok: false, reason: 'INVALID_REFERENCE', message: 'Malformed Quran reference' };
  }

  const rows = await prisma.ayah.findMany({
    where: { surahId: ref.surahId, ayahNumber: { gte: ref.startAyah, lte: ref.endAyah } },
    orderBy: { ayahNumber: 'asc' },
    select: {
      surahId: true,
      ayahNumber: true,
      textAr: true,
      page: true,
      juz: true,
      surah: { select: { nameAr: true } },
    },
  });

  const expected = ref.endAyah - ref.startAyah + 1;
  const contiguous = rows.every((row, i) => row.ayahNumber === ref.startAyah + i);
  if (rows.length !== expected || !contiguous) {
    return {
      ok: false,
      reason: 'AYAH_NOT_FOUND',
      message: `Quran reference ${ref.surahId}:${ref.startAyah}${ref.endAyah !== ref.startAyah ? `-${ref.endAyah}` : ''} does not exist`,
    };
  }

  return {
    ok: true,
    ayahs: rows.map((row) => ({
      surahId: row.surahId,
      ayahNumber: row.ayahNumber,
      surahNameAr: resolveSurahNameAr(row.surahId, row.surah?.nameAr),
      text: toDisplayAyahText(row),
      page: row.page,
      juz: row.juz,
    })),
  };
}

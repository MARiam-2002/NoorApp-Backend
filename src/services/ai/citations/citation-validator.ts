import { prisma } from '../../../lib/prisma';
import { MAX_REFERENCE_RANGE } from '../intent/quran-reference-parser';
import { citationKey, type QuranCitationRef } from './citation-parser';

const QURAN_SURAH_COUNT = 114;

export type CitationInvalidReason = 'INVALID_SURAH' | 'INVALID_RANGE' | 'RANGE_TOO_LARGE' | 'AYAH_NOT_FOUND';

export type InvalidCitation = { citation: QuranCitationRef; reason: CitationInvalidReason };

export type CitationValidationResult = {
  valid: QuranCitationRef[];
  invalid: InvalidCitation[];
};

function structuralProblem(c: QuranCitationRef): CitationInvalidReason | null {
  if (c.surahId < 1 || c.surahId > QURAN_SURAH_COUNT) return 'INVALID_SURAH';
  if (c.startAyah < 1 || c.endAyah < c.startAyah) return 'INVALID_RANGE';
  if (c.endAyah - c.startAyah + 1 > MAX_REFERENCE_RANGE) return 'RANGE_TOO_LARGE';
  return null;
}

/**
 * A citation is valid only if every ayah it covers exists in the `ayahs` table.
 * Citation text is never trusted as evidence; this checks existence only.
 */
export async function validateQuranCitations(
  citations: readonly QuranCitationRef[],
): Promise<CitationValidationResult> {
  const valid: QuranCitationRef[] = [];
  const invalid: InvalidCitation[] = [];
  const toCheck: QuranCitationRef[] = [];

  for (const c of citations) {
    const problem = structuralProblem(c);
    if (problem) invalid.push({ citation: c, reason: problem });
    else toCheck.push(c);
  }
  if (toCheck.length === 0) return { valid, invalid };

  const unique = new Map<string, QuranCitationRef>();
  for (const c of toCheck) unique.set(citationKey(c), c);

  const rows = await prisma.ayah.findMany({
    where: {
      OR: [...unique.values()].map((c) => ({
        surahId: c.surahId,
        ayahNumber: { gte: c.startAyah, lte: c.endAyah },
      })),
    },
    select: { surahId: true, ayahNumber: true },
  });
  const present = new Set(rows.map((r) => `${r.surahId}:${r.ayahNumber}`));

  for (const c of toCheck) {
    let complete = true;
    for (let n = c.startAyah; n <= c.endAyah; n += 1) {
      if (!present.has(`${c.surahId}:${n}`)) {
        complete = false;
        break;
      }
    }
    if (complete) valid.push(c);
    else invalid.push({ citation: c, reason: 'AYAH_NOT_FOUND' });
  }

  return { valid, invalid };
}

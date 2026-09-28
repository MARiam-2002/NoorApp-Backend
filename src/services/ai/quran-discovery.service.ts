import { ErrorCodes, HttpStatus } from '../../config';
import { AppError } from '../../lib/errors';
import { parseQuranReference } from './intent/quran-reference-parser';
import { loadSurahCatalog } from './intent/surah-name-index';
import { lookupQuranAyahs } from './tools/quran-lookup.tool';
import { searchQuran } from './tools/quran-search.tool';

export const QURAN_DISCOVERY_MAX_QUERY_LENGTH = 200;
export const QURAN_DISCOVERY_DEFAULT_LIMIT = 10;
export const QURAN_DISCOVERY_MAX_LIMIT = 50;

/** Score of an exact reference hit (the requested ayah itself). */
const EXACT_SCORE = 1;

export type QuranDiscoveryItem = {
  surahId: number;
  ayahNumber: number;
  surahNameAr: string;
  text: string;
  page: number | null;
  juz: number | null;
  score: number;
};

export type QuranDiscoveryResult = {
  mode: 'exact' | 'search';
  results: QuranDiscoveryItem[];
};

/**
 * Deterministic Quran discovery (no LLM, no embeddings, no external calls).
 * - exact: the query is a Quran reference → the full requested ayah/range (`limit` does not apply).
 * - search: normalized keyword search over the canonical ayah text, top `limit` hits.
 */
export async function discoverQuran(query: string, limit: number): Promise<QuranDiscoveryResult> {
  const parsed = parseQuranReference(query, await loadSurahCatalog());

  if (parsed.kind === 'invalid') {
    throw new AppError(parsed.message, HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, {
      reason: parsed.reason,
    });
  }

  if (parsed.kind === 'reference') {
    const lookup = await lookupQuranAyahs(parsed.reference);
    if (!lookup.ok) {
      throw new AppError(lookup.message, HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, {
        reason: lookup.reason,
      });
    }
    return {
      mode: 'exact',
      results: lookup.ayahs.map((a) => ({ ...a, score: EXACT_SCORE })),
    };
  }

  const hits = await searchQuran(query, limit);
  return { mode: 'search', results: hits };
}

import { lookupQuranAyahs, type QuranAyahRecord } from '../tools/quran-lookup.tool';
import { parseQuranCitations, type MalformedCitation, type QuranCitationRef } from './citation-parser';
import { validateQuranCitations, type InvalidCitation } from './citation-validator';

export type ResolvedQuranCitation = {
  citation: QuranCitationRef;
  /** Ayahs read from PostgreSQL — the only Quran text a citation may ever display. */
  ayahs: QuranAyahRecord[];
};

export type CitationResolution = {
  resolved: ResolvedQuranCitation[];
  invalid: InvalidCitation[];
  malformed: MalformedCitation[];
};

export async function resolveQuranCitations(text: string): Promise<CitationResolution> {
  const { citations, malformed } = parseQuranCitations(text);
  const { valid, invalid } = await validateQuranCitations(citations);

  const resolved: ResolvedQuranCitation[] = [];
  for (const citation of valid) {
    const lookup = await lookupQuranAyahs(citation);
    if (lookup.ok) resolved.push({ citation, ayahs: lookup.ayahs });
    else invalid.push({ citation, reason: 'AYAH_NOT_FOUND' });
  }

  return { resolved, invalid, malformed };
}

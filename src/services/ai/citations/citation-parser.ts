import type { QuranReference } from '../intent/quran-reference-parser';

export type QuranCitationRef = QuranReference & {
  /** Exact marker as it appeared, e.g. "[Q:2:255-257]". */
  raw: string;
};

export type MalformedCitation = { raw: string };

export type ParsedCitations = {
  citations: QuranCitationRef[];
  malformed: MalformedCitation[];
};

const CANDIDATE = /\[Q:[^\][\r\n]*\]?/g;
const STRICT = /^\[Q:(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?\]$/;

/**
 * Extracts internal Quran citation markers `[Q:surah:ayah]` / `[Q:surah:start-end]`.
 * Syntax only — existence is checked by `validateQuranCitations` against the database.
 */
export function parseQuranCitations(text: string): ParsedCitations {
  const citations: QuranCitationRef[] = [];
  const malformed: MalformedCitation[] = [];

  for (const [raw] of (text ?? '').matchAll(CANDIDATE)) {
    const m = STRICT.exec(raw);
    if (!m) {
      malformed.push({ raw });
      continue;
    }
    const startAyah = Number(m[2]);
    citations.push({
      raw,
      surahId: Number(m[1]),
      startAyah,
      endAyah: m[3] != null ? Number(m[3]) : startAyah,
    });
  }

  return { citations, malformed };
}

export function citationKey(ref: QuranReference): string {
  return `${ref.surahId}:${ref.startAyah}-${ref.endAyah}`;
}

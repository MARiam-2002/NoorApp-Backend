import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';
import { resolveSurahNameAr } from '../../../lib/surah-names';
import {
  arabicDaggerOmittedVariants,
  arabicPrefixForms,
  arabicSearchVariants,
  arabicSkeleton,
  normalizeArabicForSearch,
  tokenizeArabic,
} from '../../../shared/utils/arabic-normalize';
import { toDisplayAyahText, type QuranAyahRecord } from './quran-lookup.tool';

export type IndexedAyah = QuranAyahRecord & {
  /** Normalized whole words as written in the ayah. Search keys only — never displayed. */
  words: ReadonlySet<string>;
  /**
   * `words` plus their forms with attached prefixes removed and dagger-alef-omitted spellings.
   * Search keys only — never displayed.
   */
  forms: ReadonlySet<string>;
  skeletons: ReadonlySet<string>;
  wordCount: number;
};

export type QuranSearchHit = QuranAyahRecord & { score: number };

export type QuranSearchRow = {
  surahId: number;
  ayahNumber: number;
  textAr: string;
  page: number | null;
  juz: number | null;
  surahNameAr: string | null;
};

/**
 * Match strength per query term. Prefix stripping cannot tell an attached و/ف/ب/ك/ل from a root
 * letter (بعيد → عيد, كتاب → تاب), and omitting the dagger alef also turns الكتاب into الكتب,
 * so any match that needed either ranks below a whole-word match. A prefix removed from the
 * query is less reliable than a form derived from the ayah word.
 */
const WEIGHT_EXACT = 1;
const WEIGHT_AYAH_FORM = 0.9;
const WEIGHT_QUERY_PREFIX_STRIPPED = 0.875;
const WEIGHT_SKELETON = 0.85;
const WEIGHT_PREFIX = 0.6;
const MIN_FUZZY_LENGTH = 3;
const MAX_QUERY_TERMS = 8;

/** Request phrasing ("آيات عن …") and function words that carry no topic. Compared after normalization. */
const QUERY_STOPWORDS = new Set(
  [
    'آية', 'آيات', 'اية', 'ايات', 'آيه', 'ايه', 'الآيات', 'الايات', 'سورة', 'سوره',
    'عن', 'حول', 'في', 'من', 'على', 'إلى', 'الى', 'ما', 'ماذا', 'هل', 'هي', 'هو',
    'التي', 'الذي', 'تتحدث', 'تتكلم', 'يتحدث', 'تذكر', 'تدل', 'أريد', 'اريد', 'ابحث', 'لي', 'و',
  ].map(normalizeArabicForSearch),
);

/**
 * Leading question phrasing removed before term extraction, so "ما حكم الربا" searches
 * for الربا only. Discovery never answers the question — it only lists matching ayahs.
 */
const LEADING_REQUEST_PHRASES = [
  'ماذا يقول القرآن عن', 'ماذا قال الله عن', 'ما حكم', 'هل يجوز', 'ما هو', 'ما هي', 'ابحث عن', 'أريد آيات عن',
]
  .map(normalizeArabicForSearch)
  .sort((a, b) => b.length - a.length);

function stripLeadingRequestPhrase(normalized: string): string {
  for (const phrase of LEADING_REQUEST_PHRASES) {
    if (normalized === phrase) return '';
    if (normalized.startsWith(`${phrase} `)) return normalized.slice(phrase.length + 1);
  }
  return normalized;
}

export function extractQueryTerms(query: string): string[] {
  const terms: string[] = [];
  for (const token of tokenizeArabic(stripLeadingRequestPhrase(normalizeArabicForSearch(query)))) {
    if (token.length < 2 || QUERY_STOPWORDS.has(token) || terms.includes(token)) continue;
    terms.push(token);
    if (terms.length >= MAX_QUERY_TERMS) break;
  }
  return terms;
}

export function buildQuranSearchIndex(rows: readonly QuranSearchRow[]): IndexedAyah[] {
  return rows.map((row) => {
    const text = toDisplayAyahText(row);
    const words = new Set<string>();
    const forms = new Set<string>();
    const skeletons = new Set<string>();
    const addForms = (token: string) => {
      for (const form of arabicPrefixForms(token)) {
        forms.add(form);
        skeletons.add(arabicSkeleton(form));
      }
    };
    for (const variant of arabicSearchVariants(text)) {
      for (const token of tokenizeArabic(variant)) {
        words.add(token);
        addForms(token);
      }
    }
    for (const variant of arabicDaggerOmittedVariants(text)) {
      for (const token of tokenizeArabic(variant)) addForms(token);
    }
    return {
      surahId: row.surahId,
      ayahNumber: row.ayahNumber,
      surahNameAr: resolveSurahNameAr(row.surahId, row.surahNameAr),
      text,
      page: row.page,
      juz: row.juz,
      words,
      forms,
      skeletons,
      wordCount: tokenizeArabic(normalizeArabicForSearch(text)).length,
    };
  });
}

type TermKeys = { term: string; strippedForms: string[]; skeletons: string[]; prefixes: string[] };

function termKeys(term: string): TermKeys {
  const forms = arabicPrefixForms(term);
  const skeletons = forms.map(arabicSkeleton).filter((s) => s.length >= MIN_FUZZY_LENGTH);
  const prefixSet = new Set(skeletons);
  // A final ه (from ة) becomes ت before suffixes: الجنة → جنات / جنتهم.
  for (const s of skeletons) if (s.endsWith('ه')) prefixSet.add(`${s.slice(0, -1)}ت`);
  return { term, strippedForms: forms.filter((f) => f !== term), skeletons, prefixes: [...prefixSet] };
}

function termScore(ayah: IndexedAyah, keys: TermKeys): number {
  if (ayah.words.has(keys.term)) return WEIGHT_EXACT;
  if (ayah.forms.has(keys.term)) return WEIGHT_AYAH_FORM;
  if (keys.strippedForms.some((f) => ayah.forms.has(f))) return WEIGHT_QUERY_PREFIX_STRIPPED;
  if (keys.skeletons.some((s) => ayah.skeletons.has(s))) return WEIGHT_SKELETON;
  if (keys.prefixes.length > 0) {
    for (const s of ayah.skeletons) {
      if (keys.prefixes.some((p) => s.startsWith(p))) return WEIGHT_PREFIX;
    }
  }
  return 0;
}

/** BM25 inverse document frequency: rare query words (القيوم) outweigh common ones (الله). */
function inverseDocumentFrequency(totalAyahs: number, matchingAyahs: number): number {
  return Math.log(1 + (totalAyahs - matchingAyahs + 0.5) / (matchingAyahs + 0.5));
}

/**
 * Deterministic ranking: per-term match strength weighted by IDF and normalized to (0, 1]
 * (a single-word query scores exactly its match strength). Equal scores prefer the shorter
 * ayah (BM25 length normalization: قل هو الله أحد → 112:1 before longer ayahs with the same
 * words), then mushaf order. Same query + same data always yields the same results.
 */
export function searchQuranIndex(index: readonly IndexedAyah[], query: string, limit: number): QuranSearchHit[] {
  const terms = extractQueryTerms(query);
  if (terms.length === 0) return [];
  const keys = terms.map(termKeys);

  const termScores = index.map((ayah) => keys.map((k) => termScore(ayah, k)));
  const idf = keys.map((_, t) =>
    inverseDocumentFrequency(index.length, termScores.reduce((n, scores) => n + (scores[t]! > 0 ? 1 : 0), 0)),
  );
  const idfTotal = idf.reduce((sum, w) => sum + w, 0);

  const ranked: Array<{ hit: QuranSearchHit; wordCount: number }> = [];
  index.forEach((ayah, i) => {
    const scores = termScores[i]!;
    const weighted = scores.reduce((sum, s, t) => sum + s * idf[t]!, 0);
    if (weighted === 0) return;
    ranked.push({
      hit: {
        surahId: ayah.surahId,
        ayahNumber: ayah.ayahNumber,
        surahNameAr: ayah.surahNameAr,
        text: ayah.text,
        page: ayah.page,
        juz: ayah.juz,
        score: Math.round((weighted / idfTotal) * 1000) / 1000,
      },
      wordCount: ayah.wordCount,
    });
  });

  ranked.sort(
    (a, b) =>
      b.hit.score - a.hit.score ||
      a.wordCount - b.wordCount ||
      a.hit.surahId - b.hit.surahId ||
      a.hit.ayahNumber - b.hit.ayahNumber,
  );
  return ranked.slice(0, limit).map((r) => r.hit);
}

let indexPromise: Promise<IndexedAyah[]> | null = null;

/** Built once per process from the `ayahs` table (static canonical text, ~6 236 rows). */
export function getQuranSearchIndex(): Promise<IndexedAyah[]> {
  if (!indexPromise) {
    const started = Date.now();
    indexPromise = prisma.ayah
      .findMany({
        orderBy: [{ surahId: 'asc' }, { ayahNumber: 'asc' }],
        select: {
          surahId: true,
          ayahNumber: true,
          textAr: true,
          page: true,
          juz: true,
          surah: { select: { nameAr: true } },
        },
      })
      .then((rows) => {
        if (rows.length === 0) throw new Error('Ayah table is empty');
        const index = buildQuranSearchIndex(
          rows.map((r) => ({ ...r, surahNameAr: r.surah?.nameAr ?? null })),
        );
        logger.info('[AI] Quran search index built', { ayahs: index.length, ms: Date.now() - started });
        return index;
      })
      .catch((err) => {
        indexPromise = null;
        throw err;
      });
  }
  return indexPromise;
}

export async function searchQuran(query: string, limit: number): Promise<QuranSearchHit[]> {
  return searchQuranIndex(await getQuranSearchIndex(), query, limit);
}

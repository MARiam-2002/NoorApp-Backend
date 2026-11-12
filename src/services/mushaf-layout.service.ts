/**
 * Exact printed-page layout of the Madani mushaf (King Fahd Complex, 604 pages, 15 lines) rendered with the
 * official QCF glyph fonts: one font per page, one glyph per word (code_v2). The same glyph codes work with the
 * monochrome V2 fonts and the colour-coded V4 tajweed fonts; only the font file changes.
 *
 * Source: Quran Foundation Content API (mushaf 1) and font CDN. Surah headings and the basmala have no word data:
 * they sit in the empty line slots, which this module assigns and validates instead of guessing. A page that does not
 * satisfy every invariant is refused (503) rather than shown with a wrong layout.
 */
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { qfFetchJson, hasQuranFoundationCredentials } from '../lib/quran-foundation';
import { CATALOG_SURAHS } from '../data/surahs';

export const MUSHAF_LAYOUT_VERSION = 1;
export const MUSHAF_TOTAL_PAGES = 604;
export const MUSHAF_LINES_PER_PAGE = 15;
const QF_MUSHAF_ID_QCF_V2 = 1;
const FONT_CDN = 'https://verses.quran.foundation/fonts/quran/hafs';

export const mushafFontIdSchema = z.enum(['qcf_v2', 'qcf_v4_tajweed']);
export type MushafFontId = z.infer<typeof mushafFontIdSchema>;

/** Basmala for heading lines (QPC Hafs text of 1:1 without its end marker), drawn with the bundled UthmanicHafs font. */
export const BASMALA_QPC_HAFS = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';

export const MUSHAF_FONTS: Record<MushafFontId, { nameAr: string; nameEn: string; colored: boolean; familyPattern: string; ttf: string; woff2: string; notes: string }> = {
  qcf_v2: {
    nameAr: 'مصحف المدينة (خط المجمع)', nameEn: 'Madinah Mushaf (QCF V2)', colored: false,
    familyPattern: 'p{page}-v2', ttf: `${FONT_CDN}/v2/ttf/p{page}.ttf`, woff2: `${FONT_CDN}/v2/woff2/p{page}.woff2`,
    notes: 'Monochrome glyphs: colour comes from the text style, so light, sepia and dark themes all work.',
  },
  qcf_v4_tajweed: {
    nameAr: 'مصحف التجويد الملوّن', nameEn: 'Colour-coded Tajweed (QCF V4)', colored: true,
    familyPattern: 'p{page}-v4', ttf: `${FONT_CDN}/v4/colrv1/ttf/p{page}.ttf`, woff2: `${FONT_CDN}/v4/colrv1/woff2/p{page}.woff2`,
    notes: 'COLRv1 colour glyphs (default palette is for light backgrounds). Use on light or sepia themes.',
  },
};

export function mushafFontFiles(font: MushafFontId, page: number) {
  const f = MUSHAF_FONTS[font];
  const p = String(page);
  return {
    id: font, family: f.familyPattern.replace('{page}', p), colored: f.colored,
    ttfUrl: f.ttf.replace('{page}', p), woff2Url: f.woff2.replace('{page}', p),
  };
}

export function getMushafFontCatalog() {
  return {
    layoutVersion: MUSHAF_LAYOUT_VERSION,
    totalPages: MUSHAF_TOTAL_PAGES,
    defaultFontId: 'qcf_v2' as MushafFontId,
    fonts: (Object.keys(MUSHAF_FONTS) as MushafFontId[]).map(id => ({
      id, ...MUSHAF_FONTS[id], ttfUrlPattern: MUSHAF_FONTS[id].ttf, woff2UrlPattern: MUSHAF_FONTS[id].woff2,
    })),
    basmala: { text: BASMALA_QPC_HAFS, font: 'UthmanicHafs (KFGQPC Uthmanic Script HAFS v18)' },
    attribution: 'Mushaf fonts © King Fahd Glorious Quran Printing Complex, provided by Quran Foundation.',
    available: hasQuranFoundationCredentials(),
  };
}

export type LayoutWord = { verseKey: string; surah: number; ayah: number; position: number; line: number; glyph: string; type: 'word' | 'end' };
export type LayoutLine =
  | { line: number; kind: 'surah_header'; surah: number; nameAr: string }
  | { line: number; kind: 'basmala'; surah: number }
  | { line: number; kind: 'text'; words: Array<Pick<LayoutWord, 'verseKey' | 'position' | 'glyph' | 'type'>> };

const totalAyahs = (surah: number) => CATALOG_SURAHS.find(s => s.id === surah)?.totalAyahs ?? 0;
const surahNameAr = (surah: number) => CATALOG_SURAHS.find(s => s.id === surah)?.nameAr ?? '';

/**
 * Places every line of one page. Rules (verified against all 604 pages of the QF V2 layout):
 * - a run of empty lines just before the first line of a surah holds its heading and basmala (one line for al-Fatihah,
 *   whose basmala is verse 1, and for at-Tawbah, which has none);
 * - when a surah starts at the top of a page, its heading may sit on the last line of the previous page, so the run is
 *   only the basmala;
 * - a trailing empty line at the end of a page is the heading of the surah that starts on the next page.
 */
export function buildMushafLines(page: number, words: LayoutWord[]): LayoutLine[] {
  if (words.length === 0) throw new Error('Empty page');
  const byLine = new Map<number, LayoutWord[]>();
  for (const w of words) {
    if (!Number.isInteger(w.line) || w.line < 1 || w.line > MUSHAF_LINES_PER_PAGE) throw new Error(`Invalid line ${w.line}`);
    if (!byLine.has(w.line)) byLine.set(w.line, []);
    byLine.get(w.line)!.push(w);
  }
  const lineCount = page <= 2 ? Math.max(...byLine.keys()) : MUSHAF_LINES_PER_PAGE;
  const starts = new Map<number, number>(); // first line → surah starting there
  for (const w of words) if (w.ayah === 1 && w.position === 1) starts.set(w.line, w.surah);

  const empty = Array.from({ length: lineCount }, (_, i) => i + 1).filter(l => !byLine.has(l));
  const runs: number[][] = [];
  for (const l of empty) {
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === l - 1) last.push(l); else runs.push([l]);
  }
  const special = new Map<number, LayoutLine>();
  const headed = new Set<number>();
  for (const run of runs) {
    const after = run[run.length - 1]! + 1;
    const surah = starts.get(after);
    if (surah !== undefined) {
      const noBasmala = surah === 1 || surah === 9;
      if (run.length === 2 && !noBasmala) {
        special.set(run[0]!, { line: run[0]!, kind: 'surah_header', surah, nameAr: surahNameAr(surah) });
        special.set(run[1]!, { line: run[1]!, kind: 'basmala', surah });
      } else if (run.length === 1 && noBasmala) {
        special.set(run[0]!, { line: run[0]!, kind: 'surah_header', surah, nameAr: surahNameAr(surah) });
      } else if (run.length === 1 && run[0] === 1 && !noBasmala) {
        special.set(1, { line: 1, kind: 'basmala', surah }); // heading is on the previous page
      } else {
        throw new Error(`Unexpected empty lines before surah ${surah} on page ${page}`);
      }
      headed.add(surah);
      continue;
    }
    // Trailing line: heading of the surah that begins on the next page.
    const lastWord = words[words.length - 1]!;
    if (run.length !== 1 || run[0] !== lineCount || lastWord.type !== 'end' || lastWord.ayah !== totalAyahs(lastWord.surah) || lastWord.surah >= 114) {
      throw new Error(`Unexpected empty line ${run.join(',')} on page ${page}`);
    }
    const next = lastWord.surah + 1;
    special.set(run[0]!, { line: run[0]!, kind: 'surah_header', surah: next, nameAr: surahNameAr(next) });
  }
  for (const [line, surah] of starts) {
    if (!headed.has(surah)) throw new Error(`Surah ${surah} starting on line ${line} of page ${page} has no heading`);
  }
  return Array.from({ length: lineCount }, (_, i) => {
    const line = i + 1;
    const s = special.get(line);
    if (s) return s;
    const ws = byLine.get(line)!;
    return { line, kind: 'text' as const, words: ws.map(w => ({ verseKey: w.verseKey, position: w.position, glyph: w.glyph, type: w.type })) };
  });
}

type QfWord = { position: number; line_number: number; page_number: number; code_v2?: string; char_type_name?: string };
type QfVerse = { verse_key: string; verse_number: number; juz_number?: number; hizb_number?: number; rub_el_hizb_number?: number; words?: QfWord[] };
type QfPage = { verses: QfVerse[]; pagination: { next_page: number | null; total_records: number } };

const cache = new Map<number, { expires: number; data: { words: LayoutWord[]; verses: Array<{ key: string; juz?: number; hizb?: number; rubElHizb?: number }> } }>();
const pending = new Map<number, Promise<any>>();
const CACHE_MS = 6 * 60 * 60 * 1000; // well under the provider's one-week cache limit

async function loadPageWords(page: number) {
  const hit = cache.get(page);
  if (hit && hit.expires > Date.now()) return hit.data;
  if (pending.has(page)) return pending.get(page)!;
  const request = (async () => {
    const words: LayoutWord[] = [];
    const verses: Array<{ key: string; juz?: number; hizb?: number; rubElHizb?: number }> = [];
    let cursor: number | null = 1;
    let total: number | null = null;
    for (let i = 0; cursor !== null && i < 8; i++) {
      const res: QfPage | null = await qfFetchJson<QfPage>(`/verses/by_page/${page}`, {
        mushaf: QF_MUSHAF_ID_QCF_V2, words: 'true', word_fields: 'code_v2,line_number,page_number', per_page: 50, page: cursor,
      }, false);
      if (!res || !Array.isArray(res.verses) || !res.pagination) throw new Error('Invalid provider response');
      if (total !== null && total !== res.pagination.total_records) throw new Error('Provider content changed during pagination');
      total = res.pagination.total_records;
      for (const v of res.verses) {
        const [surah, ayah] = v.verse_key.split(':').map(Number);
        if (!surah || ayah !== v.verse_number || ayah > totalAyahs(surah) || !Array.isArray(v.words) || v.words.length === 0) throw new Error('Invalid verse');
        verses.push({ key: v.verse_key, juz: v.juz_number, hizb: v.hizb_number, rubElHizb: v.rub_el_hizb_number });
        v.words.forEach((w, idx) => {
          const type = w.char_type_name === 'end' ? 'end' : w.char_type_name === 'word' ? 'word' : null;
          if (!type || w.position !== idx + 1 || w.page_number !== page || typeof w.code_v2 !== 'string' || w.code_v2.length === 0 || w.code_v2.length > 8) {
            throw new Error('Invalid word');
          }
          words.push({ verseKey: v.verse_key, surah, ayah, position: w.position, line: w.line_number, glyph: w.code_v2, type });
        });
        if (words[words.length - 1]!.type !== 'end') throw new Error('Verse without end marker');
      }
      const next: number | null = res.pagination.next_page;
      if (next !== null && (!Number.isInteger(next) || next <= cursor)) throw new Error('Invalid pagination');
      cursor = next;
    }
    if (cursor !== null || verses.length !== total || new Set(verses.map(v => v.key)).size !== verses.length) throw new Error('Incomplete page');
    const data = { words, verses };
    if (cache.size >= 700) cache.delete(cache.keys().next().value!);
    cache.set(page, { expires: Date.now() + CACHE_MS, data });
    return data;
  })();
  pending.set(page, request);
  try { return await request; } finally { pending.delete(page); }
}

export async function getMushafPageLayout(page: number, font: MushafFontId = 'qcf_v2') {
  if (!Number.isInteger(page) || page < 1 || page > MUSHAF_TOTAL_PAGES) throw new AppError('Page outside this edition', 400, ErrorCodes.VALIDATION_ERROR);
  if (!hasQuranFoundationCredentials()) throw new AppError('Verified edition content is unavailable', 503, ErrorCodes.INTERNAL_SERVER_ERROR, { reason: 'QF_CREDENTIALS_REQUIRED' });
  let lines: LayoutLine[];
  let verses: Array<{ key: string; juz?: number; hizb?: number; rubElHizb?: number }>;
  try {
    const data = await loadPageWords(page);
    lines = buildMushafLines(page, data.words);
    verses = data.verses;
  } catch {
    throw new AppError('Quran content provider temporarily unavailable', 503, ErrorCodes.INTERNAL_SERVER_ERROR);
  }
  const first = verses[0]!;
  const surahs = Array.from(new Set(verses.map(v => Number(v.key.split(':')[0])))).map(id => ({ id, nameAr: surahNameAr(id) }));
  return {
    editionId: 'madani-hafs' as const,
    layoutVersion: MUSHAF_LAYOUT_VERSION,
    page, totalPages: MUSHAF_TOTAL_PAGES,
    lineCount: lines.length,
    /** Pages 1 and 2 are drawn centred inside an ornamental frame; every other page is fully justified. */
    centeredPage: page <= 2,
    juz: first.juz ?? null, hizb: first.hizb ?? null, rubElHizb: first.rubElHizb ?? null,
    surahs,
    firstVerseKey: first.key, lastVerseKey: verses[verses.length - 1]!.key,
    verseKeys: verses.map(v => v.key),
    font: mushafFontFiles(font, page),
    basmala: { text: BASMALA_QPC_HAFS, font: 'UthmanicHafs' },
    lines,
    attribution: 'Quran Foundation · KFGQPC',
  };
}

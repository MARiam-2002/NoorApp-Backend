/**
 * Offline lookup of verbatim phrases in the local Sahih al-Bukhari / Sahih Muslim editions
 * (prisma/data/hadith, fawazahmed0/hadith-api). Used to build and verify cited content — never at runtime.
 * Numbers: Bukhari edition number (= Fath al-Bari); Muslim Fuad Abd al-Baqi number (via eng-muslim `arabicnumber`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeArabicForSearch } from '../../src/shared/utils/arabic-normalize';

export type SahihCollection = 'bukhari' | 'muslim' | 'tirmidhi' | 'abudawud';

export type SahihMatch = {
  collection: SahihCollection;
  number: number;
  excerptAr: string;
};

type Edition = { hadiths: { hadithnumber: number; arabicnumber?: number; text: string }[] };
type Indexed = { number: number; words: string[]; keys: string[] };

const DATA_DIR = join(process.cwd(), 'prisma', 'data', 'hadith');

/** Letters-only key per word: ignores diacritics, punctuation and alef/hamza spelling. */
function wordKey(word: string): string {
  return normalizeArabicForSearch(word).replace(/[^\u0621-\u064A]/g, '').replace(/\u0627/g, '');
}

function loadEdition(file: string): Edition {
  const path = join(DATA_DIR, file);
  if (!existsSync(path)) throw new Error(`Missing ${path} — download it from fawazahmed0/hadith-api editions first`);
  return JSON.parse(readFileSync(path, 'utf8')) as Edition;
}

const cache: Partial<Record<SahihCollection, Indexed[]>> = {};

const build = (edition: Edition, toNumber: (n: number) => number | null): Indexed[] =>
  edition.hadiths.flatMap((h) => {
    const number = toNumber(h.hadithnumber);
    if (!number || !h.text) return [];
    const words = h.text.split(/\s+/).filter(Boolean);
    return [{ number, words, keys: words.map(wordKey) }];
  });

/** Collections are loaded on first use (al-Tirmidhi only by the tests that cite it). */
function index(collection: SahihCollection): Indexed[] {
  const hit = cache[collection];
  if (hit) return hit;
  let built: Indexed[];
  if (collection === 'muslim') {
    const muslimStandard = new Map(
      loadEdition('eng-muslim.json').hadiths.map((h) => [h.hadithnumber, Math.trunc(Number(h.arabicnumber))]),
    );
    built = build(loadEdition('ara-muslim.json'), (n) => muslimStandard.get(n) || null);
  } else {
    // al-Bukhari: Fath al-Bari numbering; al-Tirmidhi: the standard (Shakir) numbering used by this edition.
    built = build(loadEdition(`ara-${collection}.json`), (n) => n);
  }
  cache[collection] = built;
  return built;
}

/** Gradings recorded for a hadith of al-Tirmidhi or Abu Dawud (eng-* edition), e.g. { 'Al-Albani': 'Sahih' }. */
export function tirmidhiGrades(number: number, collection: 'tirmidhi' | 'abudawud' = 'tirmidhi'): Record<string, string> {
  const raw = JSON.parse(readFileSync(join(DATA_DIR, `eng-${collection}.json`), 'utf8')) as { hadiths: { hadithnumber: number; grades?: { name: string; grade: string }[] }[] };
  const h = raw.hadiths.find((x) => x.hadithnumber === number);
  return Object.fromEntries((h?.grades ?? []).map((g) => [g.name, g.grade]));
}

/** All occurrences of `phrase` (word sequence) in a collection, lowest number first, excerpt copied verbatim. */
export function findSahihPhrase(collection: SahihCollection, phrase: string): SahihMatch[] {
  const target = phrase.split(/\s+/).map(wordKey).filter(Boolean);
  if (target.length === 0) return [];
  const matches: SahihMatch[] = [];
  for (const h of index(collection)) {
    const positions = h.keys.map((k, i) => [k, i] as const).filter(([k]) => k.length > 0);
    for (let start = 0; start + target.length <= positions.length; start += 1) {
      if (target.every((t, j) => positions[start + j][0] === t)) {
        const from = positions[start][1];
        const to = positions[start + target.length - 1][1];
        matches.push({ collection, number: h.number, excerptAr: h.words.slice(from, to + 1).join(' ') });
        break;
      }
    }
  }
  return matches.sort((a, b) => a.number - b.number);
}

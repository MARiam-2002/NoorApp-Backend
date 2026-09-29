/**
 * Offline lookup of verbatim phrases in the local Sahih al-Bukhari / Sahih Muslim editions
 * (prisma/data/hadith, fawazahmed0/hadith-api). Used to build and verify cited content — never at runtime.
 * Numbers: Bukhari edition number (= Fath al-Bari); Muslim Fuad Abd al-Baqi number (via eng-muslim `arabicnumber`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeArabicForSearch } from '../../src/shared/utils/arabic-normalize';

export type SahihCollection = 'bukhari' | 'muslim';

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

let cache: Record<SahihCollection, Indexed[]> | null = null;

function index(): Record<SahihCollection, Indexed[]> {
  if (cache) return cache;
  const muslimStandard = new Map(
    loadEdition('eng-muslim.json').hadiths.map((h) => [h.hadithnumber, Math.trunc(Number(h.arabicnumber))]),
  );
  const build = (edition: Edition, toNumber: (n: number) => number | null): Indexed[] =>
    edition.hadiths.flatMap((h) => {
      const number = toNumber(h.hadithnumber);
      if (!number || !h.text) return [];
      const words = h.text.split(/\s+/).filter(Boolean);
      return [{ number, words, keys: words.map(wordKey) }];
    });
  cache = {
    bukhari: build(loadEdition('ara-bukhari.json'), (n) => n),
    muslim: build(loadEdition('ara-muslim.json'), (n) => muslimStandard.get(n) || null),
  };
  return cache;
}

/** All occurrences of `phrase` (word sequence) in a collection, lowest number first, excerpt copied verbatim. */
export function findSahihPhrase(collection: SahihCollection, phrase: string): SahihMatch[] {
  const target = phrase.split(/\s+/).map(wordKey).filter(Boolean);
  if (target.length === 0) return [];
  const matches: SahihMatch[] = [];
  for (const h of index()[collection]) {
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

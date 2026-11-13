/**
 * Test helper: proves a verse key (or short range) contains a phrase, using the bundled word-by-word Quran data
 * (src/shared/data/quran-library/morphology.json.gz). The key ignores alef, hamza seats and ya, where the Uthmani and
 * the plain spelling differ (سَيِّـَٔاتِهِم / سيئاتهم); a few distinctive words are still enough to pin the ayah.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { normalizeArabicForSearch } from '../../src/shared/utils/arabic-normalize';

let verses: Map<string, string[]> | null = null;
function load() {
  if (verses) return verses;
  const morph = JSON.parse(gunzipSync(readFileSync('src/shared/data/quran-library/morphology.json.gz')).toString()) as [number, number, [string, unknown][]][];
  verses = new Map(morph.map(([s, v, words]) => [`${s}:${v}`, words.map((w) => w[0])]));
  if (verses.size !== 6236) throw new Error(`morphology has ${verses.size} ayat`);
  return verses;
}
const key = (w: string) => normalizeArabicForSearch(w).replace(/[^ء-ي]/g, '').replace(/[اء-ئىي]/g, '').replace(/ة/g, 'ه');
const keys = (t: string) => t.split(/\s+/).map(key).filter(Boolean);

/** Throws unless every ayah of surah:from-to exists and their words contain `phrase`. */
export function assertAyahRangeContains(surah: number, from: number, to: number, phrase: string, label = '') {
  const v = load();
  const words: string[] = [];
  for (let a = from; a <= to; a++) {
    const w = v.get(`${surah}:${a}`);
    if (!w) throw new Error(`${label} ${surah}:${a} does not exist`);
    words.push(...w);
  }
  if (!phrase.trim()) return; // existence only
  const hay = ` ${words.map(key).filter(Boolean).join(' ')} `;
  if (!hay.includes(` ${keys(phrase).join(' ')} `)) throw new Error(`${label} ${surah}:${from}-${to} does not contain «${phrase}»`);
}

/** Looser key for quotes in imla'i spelling: Uthmani وٰ (الصلوٰة، الزكوٰة) and imla'i وا (الصلوات) both fold to ا. */
const looseKey = (w: string) => normalizeArabicForSearch(w.replace(/[\u064B-\u0652]/g, '').replace(/و\u0670/g, 'ا'))
  .replace(/[^\u0621-\u064A]/g, '').replace(/[\u0621\u0623\u0625\u0622]/g, 'ا').replace(/(?<=[\u0621-\u064A])وا/g, 'ا')
  .replace(/[\u0627\u0624\u0626\u0649\u064A]/g, '').replace(/\u0629/g, '\u0647');
let flat: { keys: string[]; at: string[] } | null = null;
/** Where a quoted passage (imla'i or Uthmani spelling, may cross ayat) occurs in the Quran, or null. */
export function findQuranPassage(phrase: string): string | null {
  const v = load();
  if (!flat) {
    flat = { keys: [], at: [] };
    for (const [ref, words] of v) for (const w of words) { const k = looseKey(w); if (k) { flat.keys.push(k); flat.at.push(ref); } }
  }
  const parts = phrase.split(/\.{3}|…/).map(p => p.trim()).filter(p => p.split(/\s+/).length >= 2);
  if (parts.length > 1) { const refs = parts.map(findQuranPassage); return refs.every(Boolean) ? refs[0] : null; }
  const target = phrase.replace(/[*۝]/g, ' ').replace(/[0-9٠-٩]+/g, ' ').split(/\s+/).map(looseKey).filter(Boolean);
  if (!target.length) return null;
  outer: for (let i = 0; i + target.length <= flat.keys.length; i++) {
    for (let j = 0; j < target.length; j++) if (flat.keys[i + j] !== target[j]) continue outer;
    return flat.at[i];
  }
  return null;
}

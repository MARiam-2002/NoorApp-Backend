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
  const hay = ` ${words.map(key).filter(Boolean).join(' ')} `;
  if (!hay.includes(` ${keys(phrase).join(' ')} `)) throw new Error(`${label} ${surah}:${from}-${to} does not contain «${phrase}»`);
}

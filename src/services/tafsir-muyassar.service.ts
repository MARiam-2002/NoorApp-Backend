/**
 * Verified «التفسير الميسر» (revised edition) for the tafsir screen and anywhere else Noor shows it.
 * Built by scripts/build-tafsir-muyassar.ts: every ayah group of the Quran matches tafsir.app letter for letter.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { TAFSIR_MUYASSAR_FILE } from '../shared/data/tafsir-muyassar';

export type MuyassarPassage = { surah: number; fromAyah: number; toAyah: number; textAr: string };
let index: Map<string, MuyassarPassage> | undefined;

function load(): Map<string, MuyassarPassage> {
  if (index) return index;
  const json = gunzipSync(readFileSync(join(__dirname, '../shared/data/tafsir-muyassar', TAFSIR_MUYASSAR_FILE.file))).toString('utf8');
  if (createHash('sha256').update(json).digest('hex') !== TAFSIR_MUYASSAR_FILE.jsonSha256) throw new Error('Muyassar tafsir checksum mismatch');
  const m = new Map<string, MuyassarPassage>();
  for (const [surah, fromAyah, toAyah, textAr] of JSON.parse(json) as [number, number, number, string][]) {
    const p = { surah, fromAyah, toAyah, textAr };
    for (let a = fromAyah; a <= toAyah; a++) m.set(`${surah}:${a}`, p);
  }
  index = m;
  return m;
}

/** The passage that explains this ayah (an ayah group shares one passage), or null when out of range. */
export function getMuyassarPassage(surah: number, ayah: number): MuyassarPassage | null {
  return load().get(`${surah}:${ayah}`) ?? null;
}

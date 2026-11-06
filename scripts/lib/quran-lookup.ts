/**
 * Offline verbatim Quran lookup for authored content (stories, lessons). Build-time only, never at runtime.
 * Source: prisma/data/quran-uthmani.json (Tanzil Uthmani text via alquran.cloud, the same text the app's
 * Quran catalog uses). The Basmala that this edition prefixes to ayah 1 of every surah except
 * Al-Fatiha and At-Tawbah is removed, so a cited ayah is exactly that ayah.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Ayah = { numberInSurah: number; text: string };
type Surah = { number: number; name: string; ayahs: Ayah[] };

let surahs: Surah[] | null = null;
function load(): Surah[] {
  if (!surahs) surahs = (JSON.parse(readFileSync(join(process.cwd(), 'prisma', 'data', 'quran-uthmani.json'), 'utf8')) as { surahs: Surah[] }).surahs;
  return surahs;
}

export function ayahText(surah: number, ayah: number): string {
  const s = load().find(x => x.number === surah);
  const a = s?.ayahs.find(x => x.numberInSurah === ayah);
  if (!s || !a) throw new Error(`Ayah not found: ${surah}:${ayah}`);
  let text = a.text.replace(/^\uFEFF/, '').trim();
  // The Basmala exactly as stored in this edition (Al-Fatiha 1:1), so the prefix match is exact.
  const basmala = load()[0]!.ayahs[0]!.text.replace(/^\uFEFF/, '').trim();
  if (ayah === 1 && surah !== 1 && surah !== 9) {
    // Surahs 95 and 97 store the Basmala with a shadda on the first letter (بِّسْمِ); accept both spellings.
    const prefix = [basmala, basmala.replace(/^بِ/, 'بِّ')].find(b => text.startsWith(b));
    if (!prefix) throw new Error(`Expected the Basmala prefix on ${surah}:1`);
    text = text.slice(prefix.length).trim();
  }
  if (!text) throw new Error(`Empty ayah: ${surah}:${ayah}`);
  return text;
}

/** Surah name without the «سُورَةُ» prefix, e.g. «ٱلْبَقَرَةِ». */
export function surahNameAr(surah: number): string {
  const s = load().find(x => x.number === surah);
  if (!s) throw new Error(`Surah not found: ${surah}`);
  return s.name.replace(/^سُورَةُ\s+/, '');
}

export function ayahCount(surah: number): number {
  const s = load().find(x => x.number === surah);
  if (!s) throw new Error(`Surah not found: ${surah}`);
  return s.ayahs.length;
}

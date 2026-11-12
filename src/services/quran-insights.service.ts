/**
 * Verse insights for the reader: word meanings (السراج في بيان غريب القرآن), verified causes of revelation
 * (المحرر في أسباب النزول) and authentic virtues. All static, offline-safe and source-attributed.
 */
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { CATALOG_SURAHS } from '../data/surahs';
import { ASBAB_AL_NUZUL, ASBAB_SOURCE } from '../shared/data/quran-asbab-al-nuzul';
import { GHARIB_SIRAJ, GHARIB_SOURCE } from '../shared/data/quran-gharib-siraj';
import { SURAH_VIRTUES } from '../shared/data/quran-surah-virtues';

export const QURAN_INSIGHTS_VERSION = 1;

const gharibIndex = new Map<string, ReadonlyArray<readonly [string, string]>>(GHARIB_SIRAJ.map(([s, a, w]) => [`${s}:${a}`, w]));

function checkVerse(surahId: number, ayahNumber: number) {
  const surah = CATALOG_SURAHS.find(s => s.id === surahId);
  if (!surah || !Number.isInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > surah.totalAyahs) {
    throw new AppError('Invalid Quran verse coordinates', 400, ErrorCodes.VALIDATION_ERROR);
  }
  return surah;
}

const ASBAB_LABEL_AR = { AUTHENTIC: 'سبب نزول ثابت', SUPPORTED: 'سبب نزول رجّحه المؤلف مع كلام في السند' } as const;

export function getAyahInsights(surahId: number, ayahNumber: number) {
  checkVerse(surahId, ayahNumber);
  const words = gharibIndex.get(`${surahId}:${ayahNumber}`) ?? [];
  const asbab = ASBAB_AL_NUZUL.filter(e => e.surah === surahId && ayahNumber >= e.fromAyah && ayahNumber <= e.toAyah);
  const virtues = SURAH_VIRTUES.filter(v => v.verses && v.verses.surah === surahId && ayahNumber >= v.verses.fromAyah && ayahNumber <= v.verses.toAyah);
  return {
    version: QURAN_INSIGHTS_VERSION,
    verseKey: `${surahId}:${ayahNumber}`,
    meanings: { source: GHARIB_SOURCE, words: words.map(([text, meaning]) => ({ text, meaning })) },
    asbab: {
      source: ASBAB_SOURCE,
      items: asbab.map(e => ({ fromAyah: e.fromAyah, toAyah: e.toAyah, verdict: e.verdict, verdictAr: ASBAB_LABEL_AR[e.verdict],
        narrations: e.narrations, conclusion: e.conclusion, reference: `${ASBAB_SOURCE.bookAr}، الدراسة رقم ${e.study}` })),
    },
    virtues: virtues.map(v => ({ id: v.id, titleAr: v.titleAr, textAr: v.textAr, referenceAr: v.referenceAr, verses: v.verses })),
    has: { meanings: words.length > 0, asbab: asbab.length > 0, virtues: virtues.length > 0 },
  };
}

export function getSurahVirtues(surahId: number) {
  const surah = CATALOG_SURAHS.find(s => s.id === surahId);
  if (!surah) throw new AppError('Invalid surah', 400, ErrorCodes.VALIDATION_ERROR);
  return {
    surahId, nameAr: surah.nameAr,
    virtues: SURAH_VIRTUES.filter(v => v.surahs.includes(surahId)).map(v => ({ id: v.id, titleAr: v.titleAr, textAr: v.textAr, referenceAr: v.referenceAr, verses: v.verses })),
    asbabCount: ASBAB_AL_NUZUL.filter(e => e.surah === surahId).length,
  };
}

/** Which verses have insights, for small markers in the reader (one call per surah). */
export function getSurahInsightMarkers(surahId: number) {
  const surah = CATALOG_SURAHS.find(s => s.id === surahId);
  if (!surah) throw new AppError('Invalid surah', 400, ErrorCodes.VALIDATION_ERROR);
  const asbab = new Set<number>();
  for (const e of ASBAB_AL_NUZUL) if (e.surah === surahId) for (let a = e.fromAyah; a <= e.toAyah; a++) asbab.add(a);
  const virtues = new Set<number>();
  for (const v of SURAH_VIRTUES) if (v.verses?.surah === surahId) for (let a = v.verses.fromAyah; a <= v.verses.toAyah; a++) virtues.add(a);
  return {
    surahId,
    asbabAyahs: [...asbab].sort((a, b) => a - b),
    virtueAyahs: [...virtues].sort((a, b) => a - b),
    meaningsAyahs: GHARIB_SIRAJ.filter(r => r[0] === surahId).map(r => r[1]),
  };
}

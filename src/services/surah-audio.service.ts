/** Full-surah recitation catalog (many reciters and riwayat) for continuous listening and offline download. */
import { SURAH_AUDIO_RECITERS } from '../shared/data/surah-audio-reciters';

export const SURAH_AUDIO_RIWAYAT: Record<string, string> = {
  Hafs: 'حفص عن عاصم', Warsh: 'ورش عن نافع', Qalun: 'قالون عن نافع', 'Duri-AbuAmr': 'الدوري عن أبي عمرو', 'Duri-Kisai': 'الدوري عن الكسائي',
  Susi: 'السوسي عن أبي عمرو', Bazzi: 'البزي عن ابن كثير', Qunbul: 'قنبل عن ابن كثير', 'Bazzi-Qunbul': 'البزي وقنبل عن ابن كثير',
  Shuba: 'شعبة عن عاصم', IbnDhakwan: 'ابن ذكوان عن ابن عامر', 'Khalaf-Hamza': 'خلف عن حمزة', Yaqub: 'يعقوب الحضرمي (رويس وروح)', Other: 'أخرى',
};

export function surahAudioUrl(serverUrl: string, surahId: number) {
  return `${serverUrl}${String(surahId).padStart(3, '0')}.mp3`;
}

export function getSurahAudioCatalog(riwaya?: string) {
  const rows = SURAH_AUDIO_RECITERS.filter(r => !riwaya || r[4] === riwaya);
  const counts: Record<string, number> = {};
  for (const r of SURAH_AUDIO_RECITERS) counts[r[4]] = (counts[r[4]] ?? 0) + 1;
  return {
    source: { nameAr: 'إذاعة القرآن الكريم mp3quran.net', url: 'https://mp3quran.net' },
    total: rows.length,
    reciterCount: new Set(SURAH_AUDIO_RECITERS.map(r => r[2])).size,
    riwayat: Object.entries(counts).map(([key, count]) => ({ key, nameAr: SURAH_AUDIO_RIWAYAT[key] ?? key, count })).sort((a, b) => b.count - a.count),
    recitations: rows.map(([id, nameAr, reciterId, recitationAr, riwayaKey, serverUrl]) => ({
      id, reciterId, nameAr, recitationAr, riwaya: riwayaKey, riwayaAr: SURAH_AUDIO_RIWAYAT[riwayaKey] ?? riwayaKey,
      surahUrlPattern: `${serverUrl}{NNN}.mp3`, example: surahAudioUrl(serverUrl, 1),
    })),
  };
}

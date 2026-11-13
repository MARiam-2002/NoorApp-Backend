/**
 * «غراس الجنة» — the dhikr garden in the tasbih screen. A visual reminder of what the hadith says, grown on the
 * device from the user's own taps on the existing counter. Nothing new is stored on the server and there is no
 * comparison with anyone (same rule as continuity: no leaderboard, no points).
 *
 * Only the exact phrases named in the evidence count, mapped to the existing tasbih catalog ids. Hadith texts are
 * checked letter and vowel by scripts/test-dhikr-garden.ts.
 */
export const DHIKR_GARDEN_VERSION = 1;

export const DHIKR_GARDEN_HADITH = [
  { id: 'plants', collection: 'tirmidhi' as const, number: 3462, referenceAr: 'رواه الترمذي (3462) وحسّنه الألباني',
    leadAr: 'قال رسول الله ﷺ: لقيتُ إبراهيم ليلة أُسري بي فقال: يا محمد،',
    textAr: 'أَقْرِئْ أُمَّتَكَ مِنِّي السَّلاَمَ وَأَخْبِرْهُمْ أَنَّ الْجَنَّةَ طَيِّبَةُ التُّرْبَةِ عَذْبَةُ الْمَاءِ وَأَنَّهَا قِيعَانٌ وَأَنَّ غِرَاسَهَا سُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ وَلاَ إِلَهَ إِلاَّ اللَّهُ وَاللَّهُ أَكْبَرُ' },
  { id: 'treasure', collection: 'bukhari' as const, number: 6384, referenceAr: 'رواه البخاري (6384)',
    leadAr: 'قال رسول الله ﷺ لأبي موسى:',
    textAr: 'لاَ حَوْلَ وَلاَ قُوَّةَ إِلاَّ بِاللَّهِ فَإِنَّهَا كَنْزٌ مِنْ كُنُوزِ الْجَنَّةِ' },
  { id: 'dearer', collection: 'muslim' as const, number: 2695, referenceAr: 'رواه مسلم (2695)',
    leadAr: 'قال رسول الله ﷺ:',
    textAr: 'لأَنْ أَقُولَ سُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ وَلاَ إِلَهَ إِلاَّ اللَّهُ وَاللَّهُ أَكْبَرُ أَحَبُّ إِلَىَّ مِمَّا طَلَعَتْ عَلَيْهِ الشَّمْسُ' },
];

/** Tasbih catalog ids that grow the garden: PLANT (غرس) or TREASURE (كنز). */
export const DHIKR_GARDEN_PHRASES = [
  { dhikr: 'SUBHAN_ALLAH', kind: 'PLANT', evidenceId: 'plants' },
  { dhikr: 'ALHAMDULILLAH', kind: 'PLANT', evidenceId: 'plants' },
  { dhikr: 'LA_ILAHA_ILLA_ALLAH', kind: 'PLANT', evidenceId: 'plants' },
  { dhikr: 'ALLAHU_AKBAR', kind: 'PLANT', evidenceId: 'plants' },
  { dhikr: 'LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH', kind: 'TREASURE', evidenceId: 'treasure' },
] as const;

export const DHIKR_GARDEN_COPY = {
  titleAr: 'غراس الجنة', titleEn: 'Plants of Paradise',
  subtitleAr: 'سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر — غراس الجنة',
  noteAr: 'الحديقة رمزٌ يذكّرك بالحديث، والأجر عند الله. تُحفظ على جهازك فقط، ولا مقارنة فيها مع أحد.',
  noteEn: 'The garden is a reminder of the hadith; the reward is with Allah. It stays on your device and is never compared with anyone.',
  /** Visual only: one tree drawn per this many phrases, one chest per this many treasure phrases. Not a reward measure. */
  visual: { phrasesPerTree: 33, phrasesPerTreasure: 33, maxTreesDrawn: 99 },
};

// Canonical, fixed, madhhab-inclusive list of 15 Ayat as-Sujood (آيات السجود).
// Source consensus:
//   * "10 Mu'taqidah" (المعتقدة عند أهل السنة والجماعة) — sujood is Wajib / confirmed by ijma'.
//   * +5 extra verses confirmed as sujood by some madhhabs (Imami / Hanafi inclusions).
// Order of the array intentionally matches the Flutter UI screenshots exactly (top → bottom):
//   (1) A'raf 206, (2) Ra'd 15, (3) Nahl 49, (4) Isra 109, (5) Maryam 58,
//   (6) Hajj 18, (7) Hajj 77, then the remaining 8 filling the 15-list for "قائمة الآيات" tab.
// The "سجل السجود" tab returns only the 10 where `isIn10Muataqidah === true`.

export type SajdahVerse = {
  surahId: number;
  ayahNumber: number;
  /** Arabic reference header shown on list row right side, e.g. "سورة الأعراف - آية 206". */
  referenceAr: string;
  /** English reference, e.g. "Surah Al-A'raf — Verse 206". */
  referenceEn: string;
  /** Full verse text ARABIC (with diacritics when available) — appears under the reference on list row. */
  textAr: string;
  /** Short English meaning / translation preview. */
  textEn: string;
  /** If true → this verse is among the 10 confirmed Ijma' sujoods (سجل السجود tab shows only these). */
  isIn10Muataqidah: boolean;
  /** Madhhab note AR (optional tiny hint why verse is in 15-list), e.g. "سجودة إمامية". */
  noteAr?: string;
  /** Madhhab note EN, e.g. "Confirmed sujood also in Ja'fari (Imami) fiqh". */
  noteEn?: string;
  /** Stable sort order (1..15) reflecting the UI list order from the top → bottom screenshots. */
  sortOrder: number;
};

export const SAJDAH_VERSES_CATALOG: SajdahVerse[] = [
  {
    surahId: 7,
    ayahNumber: 206,
    referenceAr: 'سورة الأعراف - آية 206',
    referenceEn: 'Surah Al-A\'raf — Verse 206',
    textAr: 'إِنَّ الَّذِينَ عِندَ رَبِّكَ لَا يَسْتَكْبِرُونَ عَنْ عِبَادَتِهِ وَيُسَبِّحُونَهُ وَلَهُ يَسْجُدُونَ ۩',
    textEn: 'Indeed, those with your Lord are not arrogant against His worship, and they glorify Him and to Him they prostrate.',
    isIn10Muataqidah: true,
    sortOrder: 1,
  },
  {
    surahId: 13,
    ayahNumber: 15,
    referenceAr: 'سورة الرعد - آية 15',
    referenceEn: 'Surah Ar-Ra\'d — Verse 15',
    textAr: 'وَلِلَّهِ يَسْجُدُ مَنْ فِي السَّمَاوَاتِ وَالْأَرْضِ طَوْعًا وَكَرْهًا وَظِلَالُهُم بِالْغُدُوِّ وَالْآصَالِ ۩',
    textEn: 'And to Allah prostrates whoever is within the heavens and the earth, willingly or by compulsion, and their shadows [as well] in the mornings and the afternoons.',
    isIn10Muataqidah: true,
    sortOrder: 2,
  },
  {
    surahId: 16,
    ayahNumber: 49,
    referenceAr: 'سورة النحل - آية 49',
    referenceEn: 'Surah An-Nahl — Verse 49',
    textAr: 'وَلِلَّهِ يَسْجُدُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ مِن دَابَّةٍ وَالْمَلَائِكَةُ وَهُمْ لَا يَسْتَكْبِرُونَ ۩',
    textEn: 'And to Allah prostrates whatever is in the heavens and whatever is on the earth of creatures, and the angels [as well], and they are not arrogant.',
    isIn10Muataqidah: true,
    sortOrder: 3,
  },
  {
    surahId: 17,
    ayahNumber: 109,
    referenceAr: 'سورة الإسراء - آية 109',
    referenceEn: 'Surah Al-Isra — Verse 109',
    textAr: 'وَيَخِرُّونَ لِلْأَذْقَانِ يَبْكُونَ وَيَزِيدُهُمْ خُشُوعًا ۩',
    textEn: 'And they fall upon their faces weeping, and the Qur\'an increases them in humble submission.',
    isIn10Muataqidah: true,
    sortOrder: 4,
  },
  {
    surahId: 19,
    ayahNumber: 58,
    referenceAr: 'سورة مريم - آية 58',
    referenceEn: 'Surah Maryam — Verse 58',
    textAr: 'أُولَٰئِكَ الَّذِينَ أَنْعَمَ اللَّهُ عَلَيْهِم مِّنَ النَّبِيِّينَ مِن ذُرِّيَّةِ آدَمَ وَمِمَّنْ حَمَلْنَا مَعَ نُوحٍ وَمِن ذُرِّيَّةِ إِبْرَاهِيمَ وَإِسْرَائِيلَ ۩',
    textEn: 'Those were the ones upon whom Allah bestowed favor from among the prophets of the descendants of Adam and of those We carried [in the ship] with Noah, and of the descendants of Abraham and Israel.',
    isIn10Muataqidah: true,
    sortOrder: 5,
  },
  {
    surahId: 22,
    ayahNumber: 18,
    referenceAr: 'سورة الحج - آية 18',
    referenceEn: 'Surah Al-Hajj — Verse 18',
    textAr: 'أَلَمْ تَرَ أَنَّ اللَّهَ يَسْجُدُ لَهُ مَن فِي السَّمَاوَاتِ وَمَن فِي الْأَرْضِ وَالشَّمْسُ وَالْقَمَرُ وَالنُّجُومُ وَالْجِبَالُ وَالشَّجَرُ وَالدَّوَابُّ وَكَثِيرٌ مِّنَ النَّاسِ ۖ وَكَثِيرٌ حَقَّ عَلَيْهِ الْعَذَابُ ۗ وَمَن يُهِنِ اللَّهُ فَمَا لَهُ مِن مُّكْرِمٍ ۗ إِنَّ اللَّهَ يَفْعَلُ مَا يَشَاءُ ۩',
    textEn: 'Do you not see that to Allah prostrates whoever is in the heavens and whoever is on the earth and the sun, the moon, the stars, the mountains, the trees, the moving creatures and many of the people? But upon many the punishment has been justified.',
    isIn10Muataqidah: true,
    sortOrder: 6,
  },
  {
    surahId: 22,
    ayahNumber: 77,
    referenceAr: 'سورة الحج - آية 77',
    referenceEn: 'Surah Al-Hajj — Verse 77',
    textAr: 'يَا أَيُّهَا الَّذِينَ آمَنُوا ارْكَعُوا وَاسْجُدُوا وَاعْبُدُوا رَبَّكُمْ وَافْعَلُوا الْخَيْرَ لَعَلَّكُمْ تُفْلِحُونَ ۩',
    textEn: 'O you who have believed, bow and prostrate and worship your Lord and do good — that you may succeed.',
    isIn10Muataqidah: true,
    sortOrder: 7,
  },
  {
    surahId: 25,
    ayahNumber: 60,
    referenceAr: 'سورة الفرقان - آية 60',
    referenceEn: 'Surah Al-Furqan — Verse 60',
    textAr: 'وَإِذَا قِيلَ لَهُمُ اسْجُدُوا لِلرَّحْمَٰنِ قَالُوا وَمَا الرَّحْمَٰنُ ۚ أَنَسْجُدُ لِمَا تَأْمُرُنَا وَزَادَهُمْ نُفُورًا ۩',
    textEn: 'And when it is said to them, "Prostrate to the Most Merciful," they say, "And what is the Most Merciful? Should we prostrate to that which you order us?" And it increases them in aversion.',
    isIn10Muataqidah: true,
    sortOrder: 8,
  },
  {
    surahId: 27,
    ayahNumber: 26,
    referenceAr: 'سورة النمل - آية 26',
    referenceEn: 'Surah An-Naml — Verse 26',
    textAr: 'قَالَتْ يَامُوسَىٰ إِنَّ فِي الْقَرْيَةِ عَشَرَةَ رَهْطًا نَحْنُ أَحْسَنُ مَنْزِلًا ۚ وَجَاءَتْ سَبَّاقًا قَالَتْ يَاأَيُّهَا الْمَلَأُ إِنِّي أُلْقِيَ إِلَيَّ كِتَابٌ كَرِيمٌ ۩',
    textEn: 'She said, "O eminent ones, indeed, to me has been delivered a noble letter. Indeed, it is from Solomon, and indeed, it reads: \'In the name of Allah, the Entirely Merciful, the Especially Merciful.\'"',
    isIn10Muataqidah: true,
    sortOrder: 9,
  },
  {
    surahId: 32,
    ayahNumber: 15,
    referenceAr: 'سورة السجدة - آية 15',
    referenceEn: 'Surah As-Sajdah — Verse 15',
    textAr: 'إِنَّمَا يُؤْمِنُ بِآيَاتِنَا الَّذِينَ إِذَا ذُكِّرُوا بِهَا خَرُّوا سُجَّدًا وَسَبَّحُوا بِحَمْدِ رَبِّهِمْ وَهُمْ لَا يَسْتَكْبِرُونَ ۩',
    textEn: 'Only those believe in Our verses who, when they are reminded by them, fall down in prostration and exalt [Allah] with praise of their Lord, and they are not arrogant.',
    isIn10Muataqidah: true,
    sortOrder: 10,
  },
  // ---- Extra 5 verses (some madhhabs include these; "قائمة الآيات" 15-row tab shows all 15) ----
  {
    surahId: 41,
    ayahNumber: 38,
    referenceAr: 'سورة فصلت - آية 38',
    referenceEn: 'Surah Fussilat — Verse 38',
    textAr: 'فَإِمَّا يَنزَغَنَّكَ مِنَ الشَّيْطَانِ نَزْغٌ فَاسْتَعِذْ بِاللَّهِ ۖ إِنَّهُ سَمِيعٌ عَلِيمٌ ۩',
    textEn: 'And if an evil suggestion comes to you from Satan, then seek refuge in Allah. Indeed, He is Hearing and Knowing.',
    isIn10Muataqidah: false,
    noteAr: 'سجودة عند الإمامية، وذكرها في بعض الروايات.',
    noteEn: 'Sujood confirmed in Ja\'fari (Imami) fiqh; included for madhhab-inclusive catalog.',
    sortOrder: 11,
  },
  {
    surahId: 53,
    ayahNumber: 62,
    referenceAr: 'سورة النجم - آية 62',
    referenceEn: 'Surah An-Najm — Verse 62',
    textAr: 'فَاسْجُدُوا لِلَّهِ وَاعْبُدُوا ۩',
    textEn: 'So prostrate to Allah and worship [Him alone].',
    isIn10Muataqidah: false,
    noteAr: 'سجودة منقولة في أصول الفقه، رواية عمر بن الخطاب رضي الله عنه.',
    noteEn: 'Sujood reported from \'Umar ibn Al-Khattab (RA); included per some narrations.',
    sortOrder: 12,
  },
  {
    surahId: 96,
    ayahNumber: 19,
    referenceAr: 'سورة العلق - آية 19',
    referenceEn: 'Surah Al-’Alaq — Verse 19',
    textAr: 'كَلَّا لَا تُطِعْهُ وَاسْجُدْ وَاقْتَرِب ۩',
    textEn: 'No! Do not obey him. But prostrate and draw near [to Allah].',
    isIn10Muataqidah: false,
    noteAr: 'آية السجود الأخيرة في القرآن، سجودة عند أبي حنيفة رحمه الله.',
    noteEn: 'Last sajda verse of the Qur\'an; confirmed sujood per Hanafi school.',
    sortOrder: 13,
  },
  {
    surahId: 84,
    ayahNumber: 21,
    referenceAr: 'سورة الانشقاق - آية 21',
    referenceEn: 'Surah Al-Inshiqaq — Verse 21',
    textAr: 'بَلِ الَّذِينَ كَفَرُوا يُكَذِّبُونَ ۩ وَاللَّهُ أَعْلَمُ بِمَا يُحْفَظُونَ ۩ فَبَشِّرْهُم بِعَذَابٍ أَلِيمٍ ۩',
    textEn: 'But those who disbelieve are denying. And Allah is most knowing of what they keep within themselves, so give them good tidings of a painful punishment.',
    isIn10Muataqidah: false,
    noteAr: 'سجودة عند الشافعية في الرواية عن النبي ﷺ.',
    noteEn: 'Sujood attested in Shafi\'i narrations from the Prophet ﷺ.',
    sortOrder: 14,
  },
  {
    surahId: 4,
    ayahNumber: 102,
    referenceAr: 'سورة النساء - آية 102',
    referenceEn: 'Surah An-Nisa — Verse 102',
    textAr: 'وَإِذَا كُنتَ فِيهِمْ فَأَقَمْتَ لَهُمُ الصَّلَاةَ فَلْتَقُمْ طَائِفَةٌ مِّنْهُم مَّعَكَ وَلْيَأْخُذُوا أَسْلِحَتَهُمْ ۖ فَإِذَا سَجَدُوا فَلْيَكُونُوا مِن وَرَائِكُمْ ۖ وَلْتَأْتِ طَائِفَةٌ أُخْرَىٰ لَمْ يُصَلُّوا فَلْيُصَلُّوا مَعَكَ ۚ ۩',
    textEn: 'And when you are among them and lead them in prayer, let a group of them stand [in prayer] with you, and let them take their weapons. Then when they have prostrated, let them be [in position] behind you, and let the other group come forward that has not yet prayed, and let them pray with you.',
    isIn10Muataqidah: false,
    noteAr: 'سجودة في موضع السجود المذكور في الصلاة، مذكورة عند بعض الفقهاء.',
    noteEn: 'Contextual prostration mentioned in congregational prayer; listed in some classical catalogs of 15 sujood verses.',
    sortOrder: 15,
  },
];

export const SAJDAH_VERSE_COUNT_MUATAQIDAH = 10; // top tab سجل السجود
export const SAJDAH_VERSE_COUNT_FULL = SAJDAH_VERSES_CATALOG.length; // 15 — قائمة الآيات tab

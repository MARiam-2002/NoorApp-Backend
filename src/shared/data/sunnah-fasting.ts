/**
 * Sunnah fasts and Islamic occasions, with their evidence.
 *
 * Every `textAr` is copied verbatim (with its diacritics) from the pinned hadith editions (fawazahmed0/hadith-api:
 * Sahih al-Bukhari, Sahih Muslim, Jami' al-Tirmidhi) and re-checked word by word by scripts/test-sunnah-fasting.ts.
 * Hadith outside the two Sahihs are only those graded sahih or hasan by al-Albani (grade recorded in that edition).
 * `leadAr` is a short neutral lead-in written by us (not a quotation) so the excerpt reads in context.
 *
 * Deliberately not included: dates whose observance scholars dispute (the Prophet's birthday, al-Isra' wal-Mi'raj,
 * the middle of Sha'ban), fasting the first nine days of Dhul-Hijjah as a stated sunnah (the hadith is disputed — the
 * ten days are shown for good deeds in general), and any supplication whose wording differs between editions.
 */
export type HadithCollection = 'bukhari' | 'muslim' | 'tirmidhi';
export type Evidence = { id: string; leadAr: string | null; textAr: string; collection: HadithCollection; number: number; referenceAr: string };

export const FASTING_EVIDENCE: Record<string, Evidence> = {
  monday: { id: 'monday', leadAr: 'سُئل النبي ﷺ عن صوم يوم الاثنين فقال:', textAr: 'ذَاكَ يَوْمٌ وُلِدْتُ فِيهِ وَيَوْمٌ بُعِثْتُ أَوْ أُنْزِلَ عَلَىَّ فِيهِ', collection: 'muslim', number: 1162, referenceAr: 'رواه مسلم (1162)' },
  monday_thursday: { id: 'monday_thursday', leadAr: 'قال رسول الله ﷺ:', textAr: 'تُعْرَضُ الأَعْمَالُ يَوْمَ الاِثْنَيْنِ وَالْخَمِيسِ فَأُحِبُّ أَنْ يُعْرَضَ عَمَلِي وَأَنَا صَائِمٌ', collection: 'tirmidhi', number: 747, referenceAr: 'رواه الترمذي (747) وصححه الألباني' },
  three_days: { id: 'three_days', leadAr: 'قال أبو هريرة رضي الله عنه: أوصاني خليلي ﷺ بثلاث، منها:', textAr: 'صِيَامِ ثَلاَثَةِ أَيَّامٍ مِنْ كُلِّ شَهْرٍ', collection: 'bukhari', number: 1981, referenceAr: 'رواه البخاري (1981)' },
  white_days: { id: 'white_days', leadAr: 'قال رسول الله ﷺ لأبي ذر:', textAr: 'إِذَا صُمْتَ مِنَ الشَّهْرِ ثَلاَثَةَ أَيَّامٍ فَصُمْ ثَلاَثَ عَشْرَةَ وَأَرْبَعَ عَشْرَةَ وَخَمْسَ عَشْرَةَ', collection: 'tirmidhi', number: 761, referenceAr: 'رواه الترمذي (761) وقال الألباني: حسن صحيح' },
  arafah: { id: 'arafah', leadAr: 'قال رسول الله ﷺ:', textAr: 'صِيَامُ يَوْمِ عَرَفَةَ أَحْتَسِبُ عَلَى اللَّهِ أَنْ يُكَفِّرَ السَّنَةَ الَّتِي قَبْلَهُ وَالسَّنَةَ الَّتِي بَعْدَهُ', collection: 'muslim', number: 1162, referenceAr: 'رواه مسلم (1162)' },
  arafah_dua: { id: 'arafah_dua', leadAr: 'قال رسول الله ﷺ:', textAr: 'خَيْرُ الدُّعَاءِ دُعَاءُ يَوْمِ عَرَفَةَ', collection: 'tirmidhi', number: 3585, referenceAr: 'رواه الترمذي (3585) وحسّنه الألباني' },
  ashura: { id: 'ashura', leadAr: 'قال رسول الله ﷺ:', textAr: 'وَصِيَامُ يَوْمِ عَاشُورَاءَ أَحْتَسِبُ عَلَى اللَّهِ أَنْ يُكَفِّرَ السَّنَةَ الَّتِي قَبْلَهُ', collection: 'muslim', number: 1162, referenceAr: 'رواه مسلم (1162)' },
  tasua: { id: 'tasua', leadAr: 'قال رسول الله ﷺ:', textAr: 'لَئِنْ بَقِيتُ إِلَى قَابِلٍ لأَصُومَنَّ التَّاسِعَ', collection: 'muslim', number: 1134, referenceAr: 'رواه مسلم (1134)' },
  six_shawwal: { id: 'six_shawwal', leadAr: 'قال رسول الله ﷺ:', textAr: 'مَنْ صَامَ رَمَضَانَ ثُمَّ أَتْبَعَهُ سِتًّا مِنْ شَوَّالٍ كَانَ كَصِيَامِ الدَّهْرِ', collection: 'muslim', number: 1164, referenceAr: 'رواه مسلم (1164)' },
  muharram: { id: 'muharram', leadAr: 'قال رسول الله ﷺ:', textAr: 'أَفْضَلُ الصِّيَامِ بَعْدَ رَمَضَانَ شَهْرُ اللَّهِ الْمُحَرَّمُ', collection: 'muslim', number: 1163, referenceAr: 'رواه مسلم (1163)' },
  shaban: { id: 'shaban', leadAr: 'قالت عائشة رضي الله عنها:', textAr: 'وَمَا رَأَيْتُهُ أَكْثَرَ صِيَامًا مِنْهُ فِي شَعْبَانَ', collection: 'bukhari', number: 1969, referenceAr: 'رواه البخاري (1969)' },
  ten_dhul_hijjah: { id: 'ten_dhul_hijjah', leadAr: 'قال رسول الله ﷺ:', textAr: 'مَا مِنْ أَيَّامٍ الْعَمَلُ الصَّالِحُ فِيهِنَّ أَحَبُّ إِلَى اللَّهِ مِنْ هَذِهِ الأَيَّامِ الْعَشْرِ', collection: 'tirmidhi', number: 757, referenceAr: 'رواه الترمذي (757) وصححه الألباني' },
  ramadan: { id: 'ramadan', leadAr: 'قال رسول الله ﷺ:', textAr: 'مَنْ صَامَ رَمَضَانَ إِيمَانًا وَاحْتِسَابًا غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ', collection: 'bukhari', number: 38, referenceAr: 'رواه البخاري (38)' },
  qadr_seek: { id: 'qadr_seek', leadAr: 'قال رسول الله ﷺ:', textAr: 'تَحَرَّوْا لَيْلَةَ الْقَدْرِ فِي الْوِتْرِ مِنَ الْعَشْرِ الأَوَاخِرِ مِنْ رَمَضَانَ', collection: 'bukhari', number: 2017, referenceAr: 'رواه البخاري (2017)' },
  qadr_qiyam: { id: 'qadr_qiyam', leadAr: 'قال رسول الله ﷺ:', textAr: 'مَنْ قَامَ لَيْلَةَ الْقَدْرِ إِيمَانًا وَاحْتِسَابًا غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ', collection: 'bukhari', number: 1901, referenceAr: 'رواه البخاري (1901)' },
  last_ten: { id: 'last_ten', leadAr: 'قالت عائشة رضي الله عنها: كان النبي ﷺ', textAr: 'إِذَا دَخَلَ الْعَشْرُ شَدَّ مِئْزَرَهُ، وَأَحْيَا لَيْلَهُ، وَأَيْقَظَ أَهْلَهُ', collection: 'bukhari', number: 2024, referenceAr: 'رواه البخاري (2024)' },
  eid_no_fast: { id: 'eid_no_fast', leadAr: 'عن أبي هريرة رضي الله عنه أن رسول الله ﷺ', textAr: 'نَهَى عَنْ صِيَامِ يَوْمَيْنِ يَوْمِ الأَضْحَى وَيَوْمِ الْفِطْرِ', collection: 'muslim', number: 1138, referenceAr: 'رواه مسلم (1138)' },
  eid_fitr_dates: { id: 'eid_fitr_dates', leadAr: 'قال أنس رضي الله عنه: كان رسول الله ﷺ', textAr: 'لاَ يَغْدُو يَوْمَ الْفِطْرِ حَتَّى يَأْكُلَ تَمَرَاتٍ', collection: 'bukhari', number: 953, referenceAr: 'رواه البخاري (953)' },
  tashreeq: { id: 'tashreeq', leadAr: 'قال رسول الله ﷺ:', textAr: 'أَيَّامُ التَّشْرِيقِ أَيَّامُ أَكْلٍ وَشُرْبٍ', collection: 'muslim', number: 1141, referenceAr: 'رواه مسلم (1141)' },
};

export type SunnahFastType = 'MONDAY' | 'THURSDAY' | 'WHITE_DAYS' | 'ARAFAH' | 'TASUA' | 'ASHURA' | 'SIX_SHAWWAL';
export const SUNNAH_FAST_TYPES: readonly SunnahFastType[] = ['MONDAY', 'THURSDAY', 'WHITE_DAYS', 'ARAFAH', 'TASUA', 'ASHURA', 'SIX_SHAWWAL'];

export const SUNNAH_FASTS: Record<SunnahFastType, { titleAr: string; shortAr: string; noteAr: string | null; evidence: string[]; reminderBodyAr: string }> = {
  MONDAY: { titleAr: 'صيام يوم الاثنين', shortAr: 'الاثنين', noteAr: null, evidence: ['monday', 'monday_thursday'], reminderBodyAr: 'يوم تُعرض فيه الأعمال، وفيه وُلد النبي ﷺ.' },
  THURSDAY: { titleAr: 'صيام يوم الخميس', shortAr: 'الخميس', noteAr: null, evidence: ['monday_thursday'], reminderBodyAr: 'يوم تُعرض فيه الأعمال.' },
  WHITE_DAYS: { titleAr: 'صيام الأيام البيض', shortAr: 'الأيام البيض', noteAr: 'الأيام 13 و14 و15 من كل شهر هجري (ويُترك 13 ذي الحجة لأنه من أيام التشريق).', evidence: ['white_days', 'three_days'], reminderBodyAr: 'صيام ثلاثة أيام من كل شهر.' },
  ARAFAH: { titleAr: 'صيام يوم عرفة', shortAr: 'عرفة', noteAr: 'يُستحب لغير الحاج.', evidence: ['arafah', 'arafah_dua'], reminderBodyAr: 'صيامه يكفّر السنة التي قبله والتي بعده.' },
  TASUA: { titleAr: 'صيام تاسوعاء', shortAr: 'تاسوعاء', noteAr: 'يُصام مع عاشوراء.', evidence: ['tasua'], reminderBodyAr: 'التاسع من المحرم، يُصام مع عاشوراء.' },
  ASHURA: { titleAr: 'صيام عاشوراء', shortAr: 'عاشوراء', noteAr: null, evidence: ['ashura'], reminderBodyAr: 'صيامه يكفّر السنة التي قبله.' },
  SIX_SHAWWAL: { titleAr: 'صيام الست من شوال', shortAr: 'الست من شوال', noteAr: 'تبدأ من ثاني أيام العيد.', evidence: ['six_shawwal'], reminderBodyAr: 'من صام رمضان وأتبعه ستًا من شوال كان كصيام الدهر.' },
};

export type ForbiddenFast = 'EID_AL_FITR' | 'EID_AL_ADHA' | 'TASHREEQ';
export const FORBIDDEN_FASTS: Record<ForbiddenFast, { titleAr: string; evidence: string[] }> = {
  EID_AL_FITR: { titleAr: 'يوم عيد الفطر: لا يُصام', evidence: ['eid_no_fast'] },
  EID_AL_ADHA: { titleAr: 'يوم عيد الأضحى: لا يُصام', evidence: ['eid_no_fast'] },
  TASHREEQ: { titleAr: 'أيام التشريق: أيام أكل وشرب', evidence: ['tashreeq'] },
};

/** Occasions by Hijri date range (inclusive). `toDay: 30` means "to the end of the month". */
export type Occasion = {
  id: string; titleAr: string; subtitleAr: string; month: number; fromDay: number; toMonth?: number; toDay: number;
  deedsAr: string[]; evidence: string[]; remindEve: boolean; reminderTitleAr?: string; reminderBodyAr?: string;
};
export const OCCASIONS: readonly Occasion[] = [
  { id: 'MUHARRAM', titleAr: 'شهر الله المحرّم', subtitleAr: 'أفضل الصيام بعد رمضان', month: 1, fromDay: 1, toDay: 30,
    deedsAr: ['الإكثار من الصيام في هذا الشهر'], evidence: ['muharram'], remindEve: false },
  { id: 'ASHURA', titleAr: 'تاسوعاء وعاشوراء', subtitleAr: 'التاسع والعاشر من المحرم', month: 1, fromDay: 9, toDay: 10,
    deedsAr: ['صيام التاسع والعاشر'], evidence: ['ashura', 'tasua'], remindEve: false },
  { id: 'SHABAN', titleAr: 'شهر شعبان', subtitleAr: 'كان النبي ﷺ يكثر فيه الصيام', month: 8, fromDay: 1, toDay: 30,
    deedsAr: ['الإكثار من الصيام استعدادًا لرمضان'], evidence: ['shaban'], remindEve: false },
  { id: 'RAMADAN', titleAr: 'شهر رمضان', subtitleAr: 'صيامه فريضة', month: 9, fromDay: 1, toDay: 30,
    deedsAr: ['صيام الشهر إيمانًا واحتسابًا', 'قيام الليل', 'الإكثار من تلاوة القرآن'], evidence: ['ramadan'], remindEve: false },
  { id: 'LAST_TEN', titleAr: 'العشر الأواخر من رمضان', subtitleAr: 'فيها ليلة القدر', month: 9, fromDay: 21, toDay: 30,
    deedsAr: ['الاجتهاد في العبادة وإحياء الليل وإيقاظ الأهل', 'تحرّي ليلة القدر في الليالي الوتر'], evidence: ['last_ten', 'qadr_seek', 'qadr_qiyam'],
    remindEve: true, reminderTitleAr: 'الليلة تبدأ العشر الأواخر', reminderBodyAr: 'تحرّوا ليلة القدر في الوتر من العشر الأواخر.' },
  { id: 'EID_AL_FITR', titleAr: 'عيد الفطر', subtitleAr: 'تقبّل الله منا ومنكم', month: 10, fromDay: 1, toDay: 1,
    deedsAr: ['الأكل قبل الخروج لصلاة العيد', 'صلاة العيد', 'لا يُصام يوم العيد'], evidence: ['eid_fitr_dates', 'eid_no_fast'], remindEve: false },
  { id: 'SIX_SHAWWAL', titleAr: 'الست من شوال', subtitleAr: 'من ثاني أيام العيد حتى آخر شوال', month: 10, fromDay: 2, toDay: 30,
    deedsAr: ['صيام ستة أيام من شوال'], evidence: ['six_shawwal'], remindEve: false },
  { id: 'DHUL_HIJJAH_TEN', titleAr: 'العشر من ذي الحجة', subtitleAr: 'أحب الأيام إلى الله فيها العمل الصالح', month: 12, fromDay: 1, toDay: 9,
    deedsAr: ['الإكثار من العمل الصالح من ذكر وصدقة وقراءة', 'صيام يوم عرفة لغير الحاج'], evidence: ['ten_dhul_hijjah'],
    remindEve: true, reminderTitleAr: 'غدًا تبدأ العشر من ذي الحجة', reminderBodyAr: 'أحب الأيام إلى الله فيها العمل الصالح.' },
  { id: 'ARAFAH', titleAr: 'يوم عرفة', subtitleAr: 'التاسع من ذي الحجة', month: 12, fromDay: 9, toDay: 9,
    deedsAr: ['صيامه لغير الحاج', 'الإكثار من الدعاء'], evidence: ['arafah', 'arafah_dua'], remindEve: false },
  { id: 'EID_AL_ADHA', titleAr: 'عيد الأضحى', subtitleAr: 'تقبّل الله منا ومنكم', month: 12, fromDay: 10, toDay: 10,
    deedsAr: ['صلاة العيد', 'لا يُصام يوم العيد'], evidence: ['eid_no_fast'], remindEve: false },
  { id: 'TASHREEQ', titleAr: 'أيام التشريق', subtitleAr: '11 و12 و13 من ذي الحجة', month: 12, fromDay: 11, toDay: 13,
    deedsAr: ['أيام أكل وشرب، لا تُصام'], evidence: ['tashreeq'], remindEve: false },
];

export const HIJRI_MONTHS_AR = ['محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجة'];
export const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

import type { ChallengeType } from '@prisma/client';

export const FALLBACK_VERSE = {
  textAr:
    'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ',
  referenceAr: 'آية الكرسي — سورة البقرة',
  surahNumber: 2,
  ayahNumber: 255,
};

export const FALLBACK_VERSE_FULL_SURAH = {
  id: 2,
  nameAr: 'سورة البقرة',
  nameEn: 'Al-Baqarah',
};

export const FALLBACK_HADITH = {
  textAr: 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى',
  sourceAr: 'رواه البخاري ومسلم',
};

export const FALLBACK_CHALLENGE = {
  titleAr: 'صفحتا قرآن',
  descriptionAr: 'اقرأ صفحتين من القرآن الكريم اليوم',
  type: 'QURAN_PAGES' as ChallengeType,
  targetValue: 2,
  rewardPoints: 50,
};

export const DAILY_JOURNEY_FALLBACK = {
  quranPagesRead: 0,
  adhkarCompleted: false,
  sadaqahAmount: 0,
};

export const DAY_OF_YEAR_MIN = 1;
export const DAY_OF_YEAR_MAX = 366;

export const ADHKAR_DHIKR_CATEGORIES_FALLBACK = [
  {
    key: 'MORNING',
    nameAr: 'اذكار الصباح',
    nameEn: 'Morning Dhikr',
    descriptionAr: 'الأذكار الواردة لصباح المسلم كل يوم من حصن المسلم',
    descriptionEn: 'Authentic Morning remembrances every Muslim should recite daily from Hisnul Muslim',
    iconCode: '🌤️',
    sortOrder: 1,
    totalItems: 12,
  },
  {
    key: 'EVENING',
    nameAr: 'اذكار المساء',
    nameEn: 'Evening Dhikr',
    descriptionAr: 'أذكار المساء الواردة لما يُدخل الوقت',
    descriptionEn: 'Authentic Evening remembrances at sunset from Hisnul Muslim',
    iconCode: '🌙',
    sortOrder: 2,
    totalItems: 11,
  },
  {
    key: 'BEFORE_SLEEP',
    nameAr: 'اذكار النوم',
    nameEn: 'Before Sleep Dhikr',
    descriptionAr: 'أذكار وأدعية الوِرِ النوم من السنة',
    descriptionEn: 'Authentic Dhikr and duas before going to sleep from the Sunnah',
    iconCode: '😴',
    sortOrder: 3,
    totalItems: 9,
  },
  {
    key: 'ENTERING_MOSQUE',
    nameAr: 'اذكار المسجد',
    nameEn: 'Entering Mosque',
    descriptionAr: 'أذكار دخول المسجد والجلوس',
    descriptionEn: 'Authentic Dhikr for entering and sitting in the mosque',
    iconCode: '🕌',
    sortOrder: 4,
    totalItems: 10,
  },
  {
    key: 'AFTER_PRAYER',
    nameAr: 'اذكار الصلاة',
    nameEn: 'After Salah Dhikr',
    descriptionAr: 'الأذكار بعد الصلوات المفروضة',
    descriptionEn: 'Remembrances after the five obligatory daily prayers',
    iconCode: '🤲',
    sortOrder: 5,
    totalItems: 10,
  },
  {
    key: 'GENERAL_WIRD',
    nameAr: 'وردك اليوم',
    nameEn: 'Daily Wird',
    descriptionAr: 'ورد إضافي متنوع - أذكار يومية',
    descriptionEn: 'General daily wird with authentic varied remembrances',
    iconCode: '📖',
    sortOrder: 6,
    totalItems: 10,
  },
  {
    key: 'TRAVEL',
    nameAr: 'اذكار السفر',
    nameEn: 'Travel Dhikr',
    descriptionAr: 'أذكار وأدعية السفر من السنة النبوية الصحيحة',
    descriptionEn: 'Authentic travel supplications and remembrances from the Sunnah',
    iconCode: '✈️',
    sortOrder: 7,
    totalItems: 7,
  },
  {
    key: 'SICK',
    nameAr: 'اذكار المريض والرقية',
    nameEn: 'Sick & Ruqyah',
    descriptionAr: 'أدعية المريض والرقية الشرعية من كتاب السنة',
    descriptionEn: 'Supplications for the sick person and authentic Ruqyah from the Sunnah',
    iconCode: '💊',
    sortOrder: 8,
    totalItems: 8,
  },
  {
    key: 'FOOD',
    nameAr: 'اذكار الأكل والشرب',
    nameEn: 'Food & Drink',
    descriptionAr: 'الأذكار قبل الأكل وبعده والبركة في الطعام',
    descriptionEn: 'Authentic remembrances before and after eating from the Sunnah',
    iconCode: '🍽️',
    sortOrder: 9,
    totalItems: 7,
  },
  {
    key: 'ISTIKHARA',
    nameAr: 'دعاء الاستخارة',
    nameEn: 'Istikhara Dua',
    descriptionAr: 'صلاة ودعاء الاستخارة للمسائل التي يتراءى للعبد',
    descriptionEn: 'The authentic Istikhara prayer and dua for seeking Allah counsel',
    iconCode: '🤲',
    sortOrder: 10,
    totalItems: 5,
  },
  {
    key: 'WUDU',
    nameAr: 'اذكار الوضوء',
    nameEn: 'Wudu Dhikr',
    descriptionAr: 'الأذكار قبل الوضوء وبعد فراغه والشهادة',
    descriptionEn: 'Remembrances before and after performing ablution (Wudu)',
    iconCode: '💧',
    sortOrder: 11,
    totalItems: 6,
  },
  {
    key: 'ISTIGHFAR',
    nameAr: 'اذكار الاستغفار',
    nameEn: 'Istighfar Remembrances',
    descriptionAr: 'سيد الاستغفار وجمع أذكار التوبة من السنة',
    descriptionEn: 'Sayyid al-Istighfar and authentic repentance remembrances',
    iconCode: '✨',
    sortOrder: 12,
    totalItems: 7,
  },
  {
    key: 'QAYN',
    nameAr: 'ورد القين (التسبيح)',
    nameEn: 'Counter Tasbih',
    descriptionAr: 'أذكار متنوعة مناسبة لعداد التسبيح اليومي',
    descriptionEn: 'Varied remembrances suitable for daily tasbih counter usage',
    iconCode: '📿',
    sortOrder: 13,
    totalItems: 7,
  },
  {
    key: 'MASJID_AFTER_SALAM',
    nameAr: 'اذكار بعد التسليم',
    nameEn: 'After Masjid Salam',
    descriptionAr: 'أذكار بعد السلام الأخير من الصلاة في المسجد',
    descriptionEn: 'Remembrances after the final taslim from prayer in the mosque',
    iconCode: '🕌',
    sortOrder: 14,
    totalItems: 6,
  },
];

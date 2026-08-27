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
    iconCode: '🌤️',
    sortOrder: 1,
    totalItems: 12,
  },
  {
    key: 'EVENING',
    nameAr: 'اذكار المساء',
    nameEn: 'Evening Dhikr',
    descriptionAr: 'أذكار المساء الواردة لما يُدخل الوقت',
    iconCode: '🌙',
    sortOrder: 2,
    totalItems: 11,
  },
  {
    key: 'BEFORE_SLEEP',
    nameAr: 'اذكار النوم',
    nameEn: 'Before Sleep Dhikr',
    descriptionAr: 'أذكار وأدعية الوِرِ النوم من السنة',
    iconCode: '😴',
    sortOrder: 3,
    totalItems: 9,
  },
  {
    key: 'ENTERING_MOSQUE',
    nameAr: 'اذكار المسجد',
    nameEn: 'Entering Mosque',
    descriptionAr: 'أذكار دخول المسجد والجلوس',
    iconCode: '🕌',
    sortOrder: 4,
    totalItems: 10,
  },
  {
    key: 'AFTER_PRAYER',
    nameAr: 'اذكار الصلاة',
    nameEn: 'After Salah Dhikr',
    descriptionAr: 'الأذكار بعد الصلوات المفروضة',
    iconCode: '🤲',
    sortOrder: 5,
    totalItems: 10,
  },
  {
    key: 'GENERAL_WIRD',
    nameAr: 'وردك اليوم',
    nameEn: 'Daily Wird',
    descriptionAr: 'ورد إضافي متنوع - أذكار يومية',
    iconCode: '📖',
    sortOrder: 6,
    totalItems: 10,
  },
];

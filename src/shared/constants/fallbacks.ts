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
  // Classic Sahihayn opening — only used if bank import somehow fails at call sites.
  textAr: 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى',
  sourceAr: 'رواه البخاري ومسلم',
};

/** Prefer getCuratedHadithForDay / VERIFIED_SAHIH_HADITHS for day-stable Daily Hadith. */
export {
  getCuratedHadithForDay,
  CURATED_HADITHS,
  VERIFIED_SAHIH_HADITHS,
  HADITH_BANK_META,
  getHadithBankStats,
} from './curated-hadiths';

export const FALLBACK_CHALLENGE = {
  titleAr: 'صفحتان من القرآن',
  titleEn: 'Two Quran pages',
  descriptionAr: 'اقرأ صفحتين من القرآن الكريم اليوم',
  descriptionEn: 'Read two pages of the Holy Quran today',
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
    nameAr: 'أذكار الصباح',
    nameEn: 'Morning Dhikr',
    descriptionAr: 'الأذكار الواردة لصباح المسلم كل يوم من حصن المسلم',
    descriptionEn: 'Authentic Morning remembrances every Muslim should recite daily from Hisnul Muslim',
    iconCode: '🌤️',
    sortOrder: 1,
  },
  {
    key: 'EVENING',
    nameAr: 'أذكار المساء',
    nameEn: 'Evening Dhikr',
    descriptionAr: 'أذكار المساء الواردة لما يُدخل الوقت',
    descriptionEn: 'Authentic Evening remembrances at sunset from Hisnul Muslim',
    iconCode: '🌙',
    sortOrder: 2,
  },
  {
    key: 'BEFORE_SLEEP',
    nameAr: 'أذكار النوم',
    nameEn: 'Before Sleep Dhikr',
    descriptionAr: 'أذكار وأدعية النوم من السنة',
    descriptionEn: 'Authentic Dhikr and duas before going to sleep from the Sunnah',
    iconCode: '😴',
    sortOrder: 3,
  },
  {
    key: 'ENTERING_MOSQUE',
    nameAr: 'أذكار المسجد',
    nameEn: 'Entering Mosque',
    descriptionAr: 'أذكار دخول المسجد والجلوس',
    descriptionEn: 'Authentic Dhikr for entering and sitting in the mosque',
    iconCode: '🕌',
    sortOrder: 4,
  },
  {
    key: 'AFTER_PRAYER',
    nameAr: 'أذكار الصلاة',
    nameEn: 'After Salah Dhikr',
    descriptionAr: 'الأذكار بعد الصلوات المفروضة',
    descriptionEn: 'Remembrances after the five obligatory daily prayers',
    iconCode: '🤲',
    sortOrder: 5,
  },
  {
    key: 'GENERAL_WIRD',
    nameAr: 'وردك اليوم',
    nameEn: 'Daily Wird',
    descriptionAr: 'ورد إضافي متنوع - أذكار يومية',
    descriptionEn: 'General daily wird with authentic varied remembrances',
    iconCode: '📖',
    sortOrder: 6,
  },
  {
    key: 'TRAVEL',
    nameAr: 'أذكار السفر',
    nameEn: 'Travel Dhikr',
    descriptionAr: 'أذكار وأدعية السفر من السنة النبوية الصحيحة',
    descriptionEn: 'Authentic travel supplications and remembrances from the Sunnah',
    iconCode: '✈️',
    sortOrder: 7,
  },
  {
    key: 'SICK',
    nameAr: 'أذكار المريض والرقية',
    nameEn: 'Sick & Ruqyah',
    descriptionAr: 'أدعية المريض والرقية الشرعية من كتاب السنة',
    descriptionEn: 'Supplications for the sick person and authentic Ruqyah from the Sunnah',
    iconCode: '💊',
    sortOrder: 8,
  },
  {
    key: 'FOOD',
    nameAr: 'أذكار الأكل والشرب',
    nameEn: 'Food & Drink',
    descriptionAr: 'الأذكار قبل الأكل وبعده والبركة في الطعام',
    descriptionEn: 'Authentic remembrances before and after eating from the Sunnah',
    iconCode: '🍽️',
    sortOrder: 9,
  },
  {
    key: 'ISTIKHARA',
    nameAr: 'دعاء الاستخارة',
    nameEn: 'Istikhara Dua',
    descriptionAr: 'صلاة ودعاء الاستخارة للمسائل التي يتراءى للعبد',
    descriptionEn: 'The authentic Istikhara prayer and dua for seeking Allah counsel',
    iconCode: '🤲',
    sortOrder: 10,
  },
  {
    key: 'WUDU',
    nameAr: 'أذكار الوضوء',
    nameEn: 'Wudu Dhikr',
    descriptionAr: 'الأذكار قبل الوضوء وبعد فراغه والشهادة',
    descriptionEn: 'Remembrances before and after performing ablution (Wudu)',
    iconCode: '💧',
    sortOrder: 11,
  },
  {
    key: 'ISTIGHFAR',
    nameAr: 'أذكار الاستغفار',
    nameEn: 'Istighfar Remembrances',
    descriptionAr: 'سيد الاستغفار وجمع أذكار التوبة من السنة',
    descriptionEn: 'Sayyid al-Istighfar and authentic repentance remembrances',
    iconCode: '✨',
    sortOrder: 12,
  },
  {
    key: 'QAYN',
    nameAr: 'ورد القين (التسبيح)',
    nameEn: 'Counter Tasbih',
    descriptionAr: 'أذكار متنوعة مناسبة لعداد التسبيح اليومي',
    descriptionEn: 'Varied remembrances suitable for daily tasbih counter usage',
    iconCode: '📿',
    sortOrder: 13,
  },
  {
    key: 'MASJID_AFTER_SALAM',
    nameAr: 'أذكار بعد التسليم',
    nameEn: 'After Masjid Salam',
    descriptionAr: 'أذكار بعد السلام الأخير من الصلاة في المسجد',
    descriptionEn: 'Remembrances after the final taslim from prayer in the mosque',
    iconCode: '🕌',
    sortOrder: 14,
  },
  {
    key: 'WAKING_UP',
    nameAr: "أذكار الاستيقاظ",
    nameEn: "Waking Up",
    descriptionAr: "ما يقال عند الاستيقاظ من النوم، ومن استيقظ في الليل",
    descriptionEn: "What to say on waking up, and when waking during the night",
    iconCode: "🌅",
    sortOrder: 15,
  },
  {
    key: 'ADHAN',
    nameAr: "أذكار الأذان",
    nameEn: "Adhan",
    descriptionAr: "ما يقال عند سماع الأذان وبعده",
    descriptionEn: "What to say while hearing the adhan and after it",
    iconCode: "📢",
    sortOrder: 16,
  },
  {
    key: 'HOME',
    nameAr: "المنزل",
    nameEn: "Home",
    descriptionAr: "أذكار الخروج من المنزل ودخوله",
    descriptionEn: "Leaving and entering the home",
    iconCode: "🏠",
    sortOrder: 17,
  },
  {
    key: 'TOILET',
    nameAr: "دخول الخلاء والخروج منه",
    nameEn: "Restroom",
    descriptionAr: "ما يقال قبل دخول الخلاء وبعد الخروج منه",
    descriptionEn: "Before entering and after leaving the restroom",
    iconCode: "🚪",
    sortOrder: 18,
  },
  {
    key: 'DISTRESS',
    nameAr: "الهم والكرب",
    nameEn: "Worry & Distress",
    descriptionAr: "أدعية الكرب والهم والحزن من السنة الصحيحة",
    descriptionEn: "Authentic supplications for distress, worry and grief",
    iconCode: "💚",
    sortOrder: 19,
  },
  {
    key: 'FASTING',
    nameAr: "الصيام ورمضان",
    nameEn: "Fasting & Ramadan",
    descriptionAr: "دعاء الإفطار وليلة القدر ورؤية الهلال وما يقوله الصائم",
    descriptionEn: "Iftar, Laylat al-Qadr, the new crescent, and what the fasting person says",
    iconCode: "🌛",
    sortOrder: 20,
  },
  {
    key: 'WEATHER',
    nameAr: "المطر والريح",
    nameEn: "Rain & Wind",
    descriptionAr: "ما يقال عند نزول المطر وبعده وعند هبوب الريح",
    descriptionEn: "What to say when it rains, after rain, and when the wind blows",
    iconCode: "🌧️",
    sortOrder: 21,
  },
  {
    key: 'DAILY_SITUATIONS',
    nameAr: "مواقف يومية",
    nameEn: "Everyday Moments",
    descriptionAr: "العطاس والغضب والمصيبة واللباس الجديد ودخول السوق وكفارة المجلس وغيرها",
    descriptionEn: "Sneezing, anger, calamity, new clothes, the market, ending a gathering and more",
    iconCode: "🌿",
    sortOrder: 22,
  },
  {
    key: 'COMPREHENSIVE_DUA',
    nameAr: "أدعية جامعة",
    nameEn: "Comprehensive Duas",
    descriptionAr: "أدعية جامعة من القرآن والسنة كان النبي ﷺ يكثر منها",
    descriptionEn: "Comprehensive supplications the Prophet ﷺ often made",
    iconCode: "💫",
    sortOrder: 23,
  },
];

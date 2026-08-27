import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { logger } from '../lib/logger';
import { getDayOfYear } from '../utils/date';

const MORNING_ITEMS_FALLBACK = [
  {
    id: 'fb-m-1',
    orderInCategory: 1,
    textAr:
      'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ. اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ عَلِمَ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِۦٓ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
    repeatCount: 1,
    referenceAr: 'آية الكرسي - سورة البقرة 255',
    benefitAr: 'من قالها حين يصبح أجير من الجن حتى يمسي (رواه البخاري ومسلم)',
  },
  {
    id: 'fb-m-2',
    orderInCategory: 2,
    textAr:
      'قُلْ هُوَ ٱللَّهُ أَحَدٌ ۝ ٱللَّهُ ٱلصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ\n\nقُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ ۝ مِن شَرِّ مَا خَلَقَ ۝ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ ۝ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ\n\nقُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ ۝ مَلِكِ ٱلنَّاسِ ۝ إِلَٰهِ ٱلنَّاسِ ۝ مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ ۝ ٱلَّذِي يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ ۝ مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ',
    repeatCount: 3,
    referenceAr: 'المعوذات ثلاث: الإخلاص والفلق والناس',
    benefitAr: 'من قرأهن حين يصبح وحين يمسي ثلاثاً كفتاه من كل شيء',
  },
  {
    id: 'fb-m-3',
    orderInCategory: 3,
    textAr: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    repeatCount: 100,
    referenceAr: 'رواه البخاري ومسلم',
    benefitAr: 'من قالها مئة مرة حُطَّتْ خَطَايَاهُ وَإِنْ كَانَتْ مِثْلَ زَبَدِ الْبَحْرِ',
  },
];

const CATEGORIES_FALLBACK = [
  {
    id: 'fb-cat-morning',
    key: 'MORNING',
    nameAr: 'اذكار الصباح',
    nameEn: 'Morning Dhikr',
    descriptionAr: 'الأذكار الواردة لصباح المسلم كل يوم من حصن المسلم',
    iconCode: '🌤️',
    sortOrder: 1,
    totalItems: 12,
  },
  {
    id: 'fb-cat-evening',
    key: 'EVENING',
    nameAr: 'اذكار المساء',
    nameEn: 'Evening Dhikr',
    descriptionAr: 'أذكار المساء الواردة لما يُدخل الوقت',
    iconCode: '🌙',
    sortOrder: 2,
    totalItems: 11,
  },
  {
    id: 'fb-cat-sleep',
    key: 'BEFORE_SLEEP',
    nameAr: 'اذكار النوم',
    nameEn: 'Before Sleep Dhikr',
    descriptionAr: 'أذكار وأدعية الوِرِ النوم من السنة',
    iconCode: '😴',
    sortOrder: 3,
    totalItems: 9,
  },
  {
    id: 'fb-cat-mosque',
    key: 'ENTERING_MOSQUE',
    nameAr: 'اذكار المسجد',
    nameEn: 'Entering Mosque',
    descriptionAr: 'أذكار دخول المسجد والجلوس',
    iconCode: '🕌',
    sortOrder: 4,
    totalItems: 10,
  },
  {
    id: 'fb-cat-prayer',
    key: 'AFTER_PRAYER',
    nameAr: 'اذكار الصلاة',
    nameEn: 'After Salah Dhikr',
    descriptionAr: 'الأذكار بعد الصلوات المفروضة',
    iconCode: '🤲',
    sortOrder: 5,
    totalItems: 10,
  },
  {
    id: 'fb-cat-wird',
    key: 'GENERAL_WIRD',
    nameAr: 'وردك اليوم',
    nameEn: 'Daily Wird',
    descriptionAr: 'ورد إضافي متنوع - أذكار يومية',
    iconCode: '📖',
    sortOrder: 6,
    totalItems: 10,
  },
];

export async function getAllCategories() {
  const fromDb = await prisma.dhikrCategory.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  if (!fromDb || fromDb.length === 0) {
    logger.warn('No DhikrCategory in DB, returning hardcoded fallback list');
    return CATEGORIES_FALLBACK;
  }

  return fromDb.map((c) => ({
    id: c.id,
    key: c.key,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    descriptionAr: c.descriptionAr,
    descriptionEn: c.descriptionEn,
    iconCode: c.iconCode,
    sortOrder: c.sortOrder,
    totalItems: c.totalItems,
  }));
}

export async function getCategoryWithItems(key: string) {
  const normalizedKey = key.trim().toUpperCase();

  const category = await prisma.dhikrCategory.findFirst({
    where: { key: normalizedKey as any },
    include: {
      items: {
        orderBy: { orderInCategory: 'asc' },
      },
    },
  });

  if (!category) {
    if (normalizedKey === 'MORNING') {
      logger.warn('No DhikrCategory for MORNING in DB, returning fallback');
      return {
        id: 'fb-cat-morning',
        key: 'MORNING',
        nameAr: 'اذكار الصباح',
        nameEn: 'Morning Dhikr',
        descriptionAr: 'الأذكار الواردة لصباح المسلم كل يوم من حصن المسلم',
        iconCode: '🌤️',
        sortOrder: 1,
        totalItems: MORNING_ITEMS_FALLBACK.length,
        items: MORNING_ITEMS_FALLBACK,
      };
    }

    throw new AppError(
      `Dhikr category not found for key: ${key}`,
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  return {
    id: category.id,
    key: category.key,
    nameAr: category.nameAr,
    nameEn: category.nameEn,
    descriptionAr: category.descriptionAr,
    descriptionEn: category.descriptionEn,
    iconCode: category.iconCode,
    sortOrder: category.sortOrder,
    totalItems: category.totalItems,
    items: category.items.map((it) => ({
      id: it.id,
      orderInCategory: it.orderInCategory,
      textAr: it.textAr,
      textArPlain: it.textArPlain,
      repeatCount: it.repeatCount,
      referenceAr: it.referenceAr,
      referenceEn: it.referenceEn,
      sourceUrl: it.sourceUrl,
      benefitAr: it.benefitAr,
    })),
  };
}

export async function getDailyWird() {
  const wirdCategory = await prisma.dhikrCategory.findFirst({
    where: { key: 'GENERAL_WIRD' },
    include: {
      items: {
        orderBy: { orderInCategory: 'asc' },
      },
    },
  });

  const day = getDayOfYear();
  const totalItems = wirdCategory?.items.length ?? CATEGORIES_FALLBACK.find((c) => c.key === 'GENERAL_WIRD')!.totalItems;
  const progress = ((day * 37) % Math.max(1, Math.min(8, totalItems))) + 1;
  const goal = Math.min(8, totalItems);

  if (!wirdCategory) {
    logger.warn('No GENERAL_WIRD category in DB, returning fallback daily wird summary');
    return {
      titleAr: 'وردك اليوم',
      subtitleAr: 'واذكر ربك إذا نسيت',
      progressItemsDone: progress,
      progressItemsTotal: goal,
      progressPercent: Math.round((progress / goal) * 100),
      ctaAr: 'اكمل وردك اليوم',
      categoryKey: 'GENERAL_WIRD',
      items: MORNING_ITEMS_FALLBACK.slice(0, goal),
    };
  }

  const slice = wirdCategory.items.slice(0, goal);

  return {
    titleAr: 'وردك اليوم',
    subtitleAr: 'واذكر ربك إذا نسيت',
    progressItemsDone: progress,
    progressItemsTotal: goal,
    progressPercent: Math.round((progress / goal) * 100),
    ctaAr: 'اكمل وردك اليوم',
    categoryKey: 'GENERAL_WIRD',
    items: slice.map((it) => ({
      id: it.id,
      orderInCategory: it.orderInCategory,
      textAr: it.textAr,
      textArPlain: it.textArPlain,
      repeatCount: it.repeatCount,
      referenceAr: it.referenceAr,
      benefitAr: it.benefitAr,
    })),
  };
}

export async function getCategoriesWithDailyWird() {
  const categories = await getAllCategories();
  const dailyWird = await getDailyWird();

  return {
    greeting: 'واذكر ربك إذا نسيت',
    dailyWird,
    categories,
  };
}

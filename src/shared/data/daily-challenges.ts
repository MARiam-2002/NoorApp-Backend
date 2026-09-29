import type { ChallengeType } from '@prisma/client';

/**
 * Daily challenge bank (rotates by day of year). Every challenge is checked automatically by
 * isDailyChallengeCompleted, so its wording must describe exactly what is measured:
 * - QURAN_PAGES: Quran pages read today >= targetValue
 * - PRAYER:      prayers logged today >= targetValue (always 5)
 * - ADHKAR:      daily wird (8 adhkar) done, or morning + evening adhkar both done (targetValue 1)
 * - SADAQAH:     sadaqah amount logged today >= targetValue
 * Quotes in «» are verbatim from Sahih al-Bukhari / Sahih Muslim with standard numbers;
 * re-verify with `npx tsx scripts/verify-challenge-citations.ts` after any edit.
 */
export type DailyChallengeDefinition = {
  type: ChallengeType;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  targetValue: number;
  rewardPoints: number;
};

export const DAILY_CHALLENGE_BANK: readonly DailyChallengeDefinition[] = [
  {
    type: 'QURAN_PAGES', targetValue: 2, rewardPoints: 50,
    titleAr: 'صفحتان من القرآن', titleEn: 'Two Quran pages',
    descriptionAr: 'اقرأ صفحتين من القرآن الكريم اليوم',
    descriptionEn: 'Read two pages of the Holy Quran today',
  },
  {
    type: 'PRAYER', targetValue: 5, rewardPoints: 100,
    titleAr: 'الصلوات الخمس في وقتها', titleEn: 'Five prayers on time',
    descriptionAr: 'أدِّ الصلوات الخمس في أوقاتها وسجّلها في التطبيق',
    descriptionEn: 'Pray all five prayers on time and log them in the app',
  },
  {
    type: 'ADHKAR', targetValue: 1, rewardPoints: 60,
    titleAr: 'وردك اليومي من الأذكار', titleEn: 'Your daily adhkar wird',
    descriptionAr: 'أكمل ورد الأذكار اليومي (8 أذكار) من تبويب الأذكار',
    descriptionEn: 'Complete the daily adhkar wird (8 adhkar) in the Adhkar tab',
  },
  {
    type: 'SADAQAH', targetValue: 5, rewardPoints: 50,
    titleAr: 'ولو بشق تمرة', titleEn: 'Even half a date',
    descriptionAr: 'قال النبي ﷺ: «اتَّقُوا النَّارَ وَلَوْ بِشِقِّ تَمْرَةٍ» (رواه البخاري — رقم 1417). تصدّق اليوم بمبلغ لا يقل عن 5 وسجّله',
    descriptionEn: 'The Prophet ﷺ said: “Protect yourselves from the Fire, even with half a date” (Sahih al-Bukhari 1417). Give at least 5 in charity today and log it',
  },
  {
    type: 'QURAN_PAGES', targetValue: 3, rewardPoints: 70,
    titleAr: 'خيركم من تعلّم القرآن', titleEn: 'The best of you',
    descriptionAr: 'قال النبي ﷺ: «خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ» (رواه البخاري — رقم 5027). اقرأ ثلاث صفحات بتدبّر',
    descriptionEn: 'The Prophet ﷺ said: “The best of you are those who learn the Quran and teach it” (Sahih al-Bukhari 5027). Read three pages with reflection',
  },
  {
    type: 'PRAYER', targetValue: 5, rewardPoints: 100,
    titleAr: 'أحب الأعمال إلى الله', titleEn: 'The most beloved deed',
    descriptionAr: 'سُئل النبي ﷺ: أي العمل أحب إلى الله؟ فقال: «الصَّلاَةُ عَلَى وَقْتِهَا» (رواه البخاري — رقم 527). حافظ على الصلوات الخمس اليوم',
    descriptionEn: 'Asked which deed Allah loves most, the Prophet ﷺ said: “Prayer at its time” (Sahih al-Bukhari 527). Keep all five prayers today',
  },
  {
    type: 'ADHKAR', targetValue: 1, rewardPoints: 80,
    titleAr: 'أذكار الصباح والمساء', titleEn: 'Morning and evening adhkar',
    descriptionAr: 'أكمل أذكار الصباح وأذكار المساء كاملة اليوم',
    descriptionEn: 'Complete both the morning and the evening adhkar today',
  },
  {
    type: 'SADAQAH', targetValue: 10, rewardPoints: 90,
    titleAr: 'صدقة اليوم', titleEn: "Today's charity",
    descriptionAr: 'تصدّق اليوم بمبلغ لا يقل عن 10 وسجّله في رحلتك',
    descriptionEn: 'Give at least 10 in charity today and log it in your journey',
  },
  {
    type: 'QURAN_PAGES', targetValue: 4, rewardPoints: 100,
    titleAr: 'القرآن شفيع لأصحابه', titleEn: 'An intercessor for its companions',
    descriptionAr: 'قال النبي ﷺ: «اقْرَءُوا الْقُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ الْقِيَامَةِ شَفِيعًا لأَصْحَابِهِ» (رواه مسلم — رقم 804). اقرأ أربع صفحات اليوم',
    descriptionEn: 'The Prophet ﷺ said: “Recite the Quran, for it will come on the Day of Resurrection as an intercessor for its companions” (Sahih Muslim 804). Read four pages today',
  },
  {
    type: 'PRAYER', targetValue: 5, rewardPoints: 100,
    titleAr: 'الصلاة نور', titleEn: 'Prayer is light',
    descriptionAr: 'قال النبي ﷺ: «وَالصَّلاَةُ نُورٌ» (رواه مسلم — رقم 223). أدِّ صلواتك الخمس اليوم',
    descriptionEn: 'The Prophet ﷺ said: “Prayer is light” (Sahih Muslim 223). Pray all five prayers today',
  },
  {
    type: 'ADHKAR', targetValue: 1, rewardPoints: 60,
    titleAr: 'مثل الحي والميت', titleEn: 'The living and the dead',
    descriptionAr: 'قال النبي ﷺ: «مَثَلُ الَّذِي يَذْكُرُ رَبَّهُ وَالَّذِي لاَ يَذْكُرُ مَثَلُ الْحَىِّ وَالْمَيِّتِ» (رواه البخاري — رقم 6407). أكمل وردك اليومي من الأذكار',
    descriptionEn: 'The Prophet ﷺ said: “The example of one who remembers his Lord and one who does not is that of the living and the dead” (Sahih al-Bukhari 6407). Complete your daily adhkar wird',
  },
  {
    type: 'SADAQAH', targetValue: 20, rewardPoints: 120,
    titleAr: 'ما نقصت صدقة من مال', titleEn: 'Charity never decreases wealth',
    descriptionAr: 'قال النبي ﷺ: «مَا نَقَصَتْ صَدَقَةٌ مِنْ مَالٍ» (رواه مسلم — رقم 2588). تصدّق اليوم بمبلغ لا يقل عن 20 وسجّله',
    descriptionEn: 'The Prophet ﷺ said: “Charity does not decrease wealth” (Sahih Muslim 2588). Give at least 20 today and log it',
  },
  {
    type: 'QURAN_PAGES', targetValue: 5, rewardPoints: 120,
    titleAr: 'خمس صفحات', titleEn: 'Five pages',
    descriptionAr: 'اقرأ خمس صفحات اليوم؛ بهذا الورد تختم القرآن في نحو أربعة أشهر',
    descriptionEn: 'Read five pages today; at this pace you complete the Quran in about four months',
  },
  {
    type: 'PRAYER', targetValue: 5, rewardPoints: 100,
    titleAr: 'يوم بلا صلاة فائتة', titleEn: 'A day with no missed prayer',
    descriptionAr: 'لا تفوّتك صلاة اليوم؛ سجّل الصلوات الخمس كلها',
    descriptionEn: "Don't miss a single prayer today; log all five",
  },
  {
    type: 'ADHKAR', targetValue: 1, rewardPoints: 80,
    titleAr: 'سبحان الله وبحمده', titleEn: 'SubhanAllahi wa bihamdihi',
    descriptionAr: 'قال النبي ﷺ: «مَنْ قَالَ سُبْحَانَ اللَّهِ وَبِحَمْدِهِ فِي يَوْمٍ مِائَةَ مَرَّةٍ حُطَّتْ خَطَايَاهُ، وَإِنْ كَانَتْ مِثْلَ زَبَدِ الْبَحْرِ» (رواه البخاري — رقم 6405). أكمل وردك اليومي من الأذكار',
    descriptionEn: 'The Prophet ﷺ said: “Whoever says SubhanAllahi wa bihamdihi a hundred times a day, his sins are wiped away even if they are like the foam of the sea” (Sahih al-Bukhari 6405). Complete your daily adhkar wird',
  },
  {
    type: 'SADAQAH', targetValue: 50, rewardPoints: 200,
    titleAr: 'صدقة السر', titleEn: 'Secret charity',
    descriptionAr: 'من السبعة الذين يظلهم الله في ظله: «وَرَجُلٌ تَصَدَّقَ أَخْفَى حَتَّى لاَ تَعْلَمَ شِمَالُهُ مَا تُنْفِقُ يَمِينُهُ» (رواه البخاري — رقم 660). تصدّق سرًّا بمبلغ لا يقل عن 50 وسجّله',
    descriptionEn: 'Among the seven whom Allah shades in His shade: “a man who gives charity so secretly that his left hand does not know what his right hand gives” (Sahih al-Bukhari 660). Give at least 50 in secret and log it',
  },
  {
    type: 'QURAN_PAGES', targetValue: 10, rewardPoints: 150,
    titleAr: 'نصف جزء', titleEn: "Half a juz'",
    descriptionAr: 'اقرأ عشر صفحات من القرآن (نحو نصف جزء)',
    descriptionEn: "Read ten pages of the Quran (about half a juz')",
  },
  {
    type: 'PRAYER', targetValue: 5, rewardPoints: 100,
    titleAr: 'صلاة العصر', titleEn: 'The Asr prayer',
    descriptionAr: 'قال النبي ﷺ: «مَنْ تَرَكَ صَلاَةَ الْعَصْرِ فَقَدْ حَبِطَ عَمَلُهُ» (رواه البخاري — رقم 553). حافظ على العصر وبقية الصلوات الخمس اليوم',
    descriptionEn: 'The Prophet ﷺ said: “Whoever abandons the Asr prayer, his deeds are nullified” (Sahih al-Bukhari 553). Keep Asr and the rest of the five prayers today',
  },
  {
    type: 'ADHKAR', targetValue: 1, rewardPoints: 60,
    titleAr: 'الاستغفار', titleEn: 'Seeking forgiveness',
    descriptionAr: 'قال النبي ﷺ: «وَاللَّهِ إِنِّي لأَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ فِي الْيَوْمِ أَكْثَرَ مِنْ سَبْعِينَ مَرَّةً» (رواه البخاري — رقم 6307). أكمل وردك اليومي من الأذكار',
    descriptionEn: 'The Prophet ﷺ said: “By Allah, I seek Allah’s forgiveness and repent to Him more than seventy times a day” (Sahih al-Bukhari 6307). Complete your daily adhkar wird',
  },
  {
    type: 'SADAQAH', targetValue: 10, rewardPoints: 90,
    titleAr: 'إطعام الطعام', titleEn: 'Feeding others',
    descriptionAr: 'سُئل النبي ﷺ: أي الإسلام خير؟ فقال: «تُطْعِمُ الطَّعَامَ، وَتَقْرَأُ السَّلاَمَ عَلَى مَنْ عَرَفْتَ وَمَنْ لَمْ تَعْرِفْ» (رواه البخاري — رقم 12). أنفق 10 على الأقل في إطعام محتاج وسجّله',
    descriptionEn: 'Asked which Islam is best, the Prophet ﷺ said: “Feed people, and greet those you know and those you do not” (Sahih al-Bukhari 12). Spend at least 10 on feeding someone in need and log it',
  },
  {
    type: 'QURAN_PAGES', targetValue: 6, rewardPoints: 130,
    titleAr: 'ست صفحات', titleEn: 'Six pages',
    descriptionAr: 'اقرأ ست صفحات من القرآن اليوم',
    descriptionEn: 'Read six pages of the Quran today',
  },
  {
    type: 'PRAYER', targetValue: 5, rewardPoints: 100,
    titleAr: 'ابدأ بالفجر', titleEn: 'Start with Fajr',
    descriptionAr: 'صلِّ الفجر في وقتها، ثم أكمل بقية الصلوات الخمس اليوم',
    descriptionEn: 'Pray Fajr on time, then complete the rest of the five prayers today',
  },
  {
    type: 'ADHKAR', targetValue: 1, rewardPoints: 80,
    titleAr: 'أحب الكلام إلى الله', titleEn: 'The most beloved words',
    descriptionAr: 'قال النبي ﷺ: «أَحَبُّ الْكَلاَمِ إِلَى اللَّهِ أَرْبَعٌ سُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ وَلاَ إِلَهَ إِلاَّ اللَّهُ وَاللَّهُ أَكْبَرُ» (رواه مسلم — رقم 2137). أكمل أذكار الصباح والمساء اليوم',
    descriptionEn: 'The Prophet ﷺ said: “The most beloved words to Allah are four: SubhanAllah, Alhamdulillah, La ilaha illallah and Allahu Akbar” (Sahih Muslim 2137). Complete the morning and evening adhkar today',
  },
  {
    type: 'SADAQAH', targetValue: 100, rewardPoints: 300,
    titleAr: 'صدقة كبيرة', titleEn: 'A generous charity',
    descriptionAr: 'تصدّق اليوم بمبلغ لا يقل عن 100 على أهل الحاجة وسجّله',
    descriptionEn: 'Give at least 100 to people in need today and log it',
  },
  {
    type: 'QURAN_PAGES', targetValue: 20, rewardPoints: 300,
    titleAr: 'جزء كامل', titleEn: "A full juz'",
    descriptionAr: 'اقرأ جزءًا كاملًا من القرآن (20 صفحة) اليوم',
    descriptionEn: "Read a full juz' of the Quran (20 pages) today",
  },
  {
    type: 'PRAYER', targetValue: 5, rewardPoints: 100,
    titleAr: 'خمس من خمس', titleEn: 'Five out of five',
    descriptionAr: 'أكمل عدّاد الصلوات اليوم: 5 من 5',
    descriptionEn: "Fill today's prayer tracker: 5 of 5",
  },
  {
    type: 'ADHKAR', targetValue: 1, rewardPoints: 60,
    titleAr: 'حصّن يومك', titleEn: 'Guard your day',
    descriptionAr: 'ابدأ يومك بأذكار الصباح واختمه بأذكار المساء، وأكمل الاثنين اليوم',
    descriptionEn: 'Start your day with the morning adhkar and end it with the evening adhkar — complete both today',
  },
  {
    type: 'SADAQAH', targetValue: 20, rewardPoints: 120,
    titleAr: 'اليد العليا', titleEn: 'The upper hand',
    descriptionAr: 'قال النبي ﷺ: «الْيَدُ الْعُلْيَا خَيْرٌ مِنَ الْيَدِ السُّفْلَى» (رواه البخاري — رقم 1427). تصدّق اليوم بمبلغ لا يقل عن 20 وسجّله',
    descriptionEn: 'The Prophet ﷺ said: “The upper hand is better than the lower hand” (Sahih al-Bukhari 1427). Give at least 20 today and log it',
  },
];

export function getDailyChallengeDefinition(dayOfYear: number): DailyChallengeDefinition {
  const n = DAILY_CHALLENGE_BANK.length;
  return DAILY_CHALLENGE_BANK[(((dayOfYear - 1) % n) + n) % n]!;
}

export type DailyChallengeTemplateRow = DailyChallengeDefinition & { dayOfYear: number };

/** One row per day 1..366, as stored in DailyChallengeTemplate. */
export function buildDailyChallengeTemplates(): DailyChallengeTemplateRow[] {
  return Array.from({ length: 366 }, (_, i) => {
    const d = getDailyChallengeDefinition(i + 1);
    return {
      dayOfYear: i + 1,
      type: d.type,
      titleAr: d.titleAr,
      titleEn: d.titleEn,
      descriptionAr: d.descriptionAr,
      descriptionEn: d.descriptionEn,
      targetValue: d.targetValue,
      rewardPoints: d.rewardPoints,
    };
  });
}

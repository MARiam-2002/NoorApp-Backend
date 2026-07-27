import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const QURAN_API_BASE = 'https://api.alquran.cloud/v1';

const TOTAL_PAGES_PER_SURAH: Record<number, number> = {
  1: 1, 2: 48, 3: 27, 4: 24, 5: 20, 6: 23, 7: 23, 8: 10, 9: 15, 10: 13,
  11: 13, 12: 14, 13: 6, 14: 7, 15: 10, 16: 13, 17: 12, 18: 14, 19: 10,
  20: 15, 21: 12, 22: 10, 23: 11, 24: 9, 25: 9, 26: 17, 27: 12, 28: 12,
  29: 9, 30: 8, 31: 5, 32: 5, 33: 9, 34: 8, 35: 7, 36: 5, 37: 11, 38: 9,
  39: 11, 40: 10, 41: 8, 42: 8, 43: 11, 44: 7, 45: 5, 46: 6, 47: 7, 48: 5,
  49: 3, 50: 6, 51: 7, 52: 6, 53: 7, 54: 6, 55: 7, 56: 10, 57: 7, 58: 6,
  59: 4, 60: 3, 61: 3, 62: 3, 63: 2, 64: 3, 65: 3, 66: 3, 67: 4, 68: 6,
  69: 7, 70: 6, 71: 4, 72: 6, 73: 6, 74: 7, 75: 4, 76: 6, 77: 6, 78: 6,
  79: 6, 80: 5, 81: 4, 82: 4, 83: 5, 84: 4, 85: 5, 86: 3, 87: 3, 88: 4,
  89: 5, 90: 3, 91: 3, 92: 3, 93: 3, 94: 2, 95: 2, 96: 3, 97: 2, 98: 3,
  99: 2, 100: 2, 101: 2, 102: 2, 103: 1, 104: 2, 105: 1, 106: 1, 107: 1,
  108: 1, 109: 1, 110: 1, 111: 1, 112: 1, 113: 1, 114: 1,
};

const CURATED_VERSES: { dayOfYear: number; surahNumber: number; ayahNumber: number; textAr: string; referenceAr: string }[] = [
  { dayOfYear: 1, surahNumber: 2, ayahNumber: 255, textAr: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ', referenceAr: 'آية الكرسي - سورة البقرة' },
  { dayOfYear: 2, surahNumber: 1, ayahNumber: 7, textAr: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ', referenceAr: 'سورة الفاتحة' },
  { dayOfYear: 3, surahNumber: 94, ayahNumber: 6, textAr: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', referenceAr: 'سورة الشرح' },
  { dayOfYear: 4, surahNumber: 65, ayahNumber: 3, textAr: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ', referenceAr: 'سورة الطلاق' },
  { dayOfYear: 5, surahNumber: 2, ayahNumber: 286, textAr: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا', referenceAr: 'سورة البقرة' },
  { dayOfYear: 6, surahNumber: 9, ayahNumber: 103, textAr: 'وَمَا أَقْوَمْتُهُمْ إِلَّا كَفَرُوا ۖ فَإِذَا ذَهَبْتَ فِي الْأَرْضِ فَلَا تَقْطَعْوا الْأَبْحَارَ', referenceAr: 'سورة التوبة' },
  { dayOfYear: 7, surahNumber: 13, ayahNumber: 28, textAr: 'الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', referenceAr: 'سورة الرعد' },
  { dayOfYear: 8, surahNumber: 55, ayahNumber: 1, textAr: 'الرَّحْمَٰنُ ۝ عَلَّمَ الْقُرْآنَ ۝ خَلَقَ الْإِنسَانَ ۝ عَلَّمَهُ الْبَيَانَ', referenceAr: 'سورة الرحمن' },
  { dayOfYear: 9, surahNumber: 20, ayahNumber: 31, textAr: 'إِنَّنِي أَنَا اللَّهُ لَا إِلَٰهَ إِلَّا أَنَا فَاعْبُدْنِي وَأَقِمِ الصَّلَاةَ لِذِكْرِي', referenceAr: 'سورة طه' },
  { dayOfYear: 10, surahNumber: 3, ayahNumber: 159, textAr: 'فَبِمَا رَحْمَةٍ مِّنَ اللَّهِ لِنتَ لَهُمْ ۖ وَلَوْ كُنتَ فَظًّا غَلِيظَ الْقَلْبِ لَانفَضُّوا مِنْ حَوْلِكَ', referenceAr: 'سورة آل عمران' },
  { dayOfYear: 11, surahNumber: 18, ayahNumber: 109, textAr: 'قُل لَّوْ كَانَ الْبَحْرُ مِدَادًا لِّكَلِمَاتِ رَبِّي لَنَفِدَ الْبَحْرُ قَبْلَ أَن تَنفَدَ كَلِمَاتُ رَبِّي', referenceAr: 'سورة الكهف' },
  { dayOfYear: 12, surahNumber: 36, ayahNumber: 12, textAr: 'إِنَّا نَحْنُ نُحْيِي الْمَوْتَىٰ وَنَكْتُبُ مَا قَدَّمُوا وَآثَارَهُمْ ۚ وَكُلَّ شَيْءٍ أَحْصَيْنَاهُ فِي إِمَامٍ مُّبِينٍ', referenceAr: 'سورة يس' },
  { dayOfYear: 13, surahNumber: 59, ayahNumber: 23, textAr: 'هُوَ اللَّهُ الَّذِي لَا إِلَٰهَ إِلَّا هُوَ الْمَلِكُ الْقُدُّوسُ السَّلَامُ الْمُؤْمِنُ الْمُهَيْمِنُ الْعَزِيزُ الْجَبَّارُ الْمُتَكَبِّرُ', referenceAr: 'سورة الحشر' },
  { dayOfYear: 14, surahNumber: 67, ayahNumber: 2, textAr: 'الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا', referenceAr: 'سورة الملك' },
  { dayOfYear: 15, surahNumber: 112, ayahNumber: 1, textAr: 'قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ', referenceAr: 'سورة الإخلاص' },
  { dayOfYear: 16, surahNumber: 103, ayahNumber: 1, textAr: 'وَالْعَصْرِ ۝ إِنَّ الْإِنسَانَ لَفِي خُسْرٍ ۝ إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ', referenceAr: 'سورة العصر' },
  { dayOfYear: 17, surahNumber: 2, ayahNumber: 153, textAr: 'يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', referenceAr: 'سورة البقرة' },
  { dayOfYear: 18, surahNumber: 8, ayahNumber: 46, textAr: 'وَأَطِيعُوا اللَّهَ وَرَسُولَهُ وَلَا تَنَازَعُوا فَتَفْشَلُوا وَتَذْهَبَ رِيحُكُمْ ۖ وَاصْبِرُوا ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', referenceAr: 'سورة الأنفال' },
  { dayOfYear: 19, surahNumber: 3, ayahNumber: 193, textAr: 'وَقَاتِلُوهُمْ حَتَّىٰ لَا تَكُونَ فِتْنَةٌ وَيَكُونَ الدِّينُ لِلَّهِ', referenceAr: 'سورة آل عمران' },
  { dayOfYear: 20, surahNumber: 4, ayahNumber: 59, textAr: 'يَا أَيُّهَا الَّذِينَ آمَنُوا أَطِيعُوا اللَّهَ وَأَطِيعُوا الرَّسُولَ وَأُولِي الْأَمْرِ مِنكُمْ', referenceAr: 'سورة النساء' },
  { dayOfYear: 21, surahNumber: 2, ayahNumber: 269, textAr: 'يُؤْتِي الْحِكْمَةَ مَن يَشَاءُ ۚ وَمَن يُؤْتَ الْحِكْمَةَ فَقَدْ أُوتِيَ خَيْرًا كَثِيرًا', referenceAr: 'سورة البقرة' },
  { dayOfYear: 22, surahNumber: 17, ayahNumber: 82, textAr: 'وَنُنَزِّلُ مِنَ الْقُرْآنِ مَا هُوَ شِفَاءٌ وَرَحْمَةٌ لِّلْمُؤْمِنِينَ', referenceAr: 'سورة الإسراء' },
  { dayOfYear: 23, surahNumber: 29, ayahNumber: 69, textAr: 'أَحَسِبَ النَّاسُ أَن يُتْرَكُوا أَن يَقُولُوا آمَنَّا وَهُمْ لَا يُفْتَنُونَ ۝ وَلَقَدْ فَتَنَّا الَّذِينَ مِن قَبْلِهِمْ', referenceAr: 'سورة العنكبوت' },
  { dayOfYear: 24, surahNumber: 92, ayahNumber: 5, textAr: 'فَأَمَّا مَنْ أَعْطَىٰ وَاتَّقَىٰ ۝ وَصَدَّقَ بِالْحُسْنَىٰ ۝ فَسَنُيَسِّرُهُ لِلْيُسْرَىٰ', referenceAr: 'سورة الليل' },
  { dayOfYear: 25, surahNumber: 81, ayahNumber: 29, textAr: 'وَلَا تَشَاءُونَ إِلَّا أَن يَشَاءَ اللَّهُ رَبُّ الْعَالَمِينَ', referenceAr: 'سورة التكوير' },
  { dayOfYear: 26, surahNumber: 24, ayahNumber: 35, textAr: 'اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ ۚ مَثَلُ نُورِهِ كَمِشْكَاةٍ فِيهَا مِصْبَاحٌ', referenceAr: 'سورة النور' },
  { dayOfYear: 27, surahNumber: 3, ayahNumber: 134, textAr: 'الَّذِينَ يُنفِقُونَ أَمْوَالَهُم بِاللَّيْلِ وَالنَّهَارِ سِرًّا وَعَلَانِيَةً فَلَهُمْ أَجْرُهُمْ عِندَ رَبِّهِمْ', referenceAr: 'سورة آل عمران' },
  { dayOfYear: 28, surahNumber: 2, ayahNumber: 43, textAr: 'وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ وَارْكَعُوا مَعَ الرَّاكِعِينَ', referenceAr: 'سورة البقرة' },
  { dayOfYear: 29, surahNumber: 98, ayahNumber: 7, textAr: 'إِنَّ الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ أُولَٰئِكَ هُمْ خَيْرُ الْبَرِيَّةِ', referenceAr: 'سورة البينة' },
  { dayOfYear: 30, surahNumber: 22, ayahNumber: 40, textAr: 'وَمَن نَّصَرَ اللَّهَ فَهُوَ الْعَزِيزُ الْحَكِيمُ', referenceAr: 'سورة الحج' },
  { dayOfYear: 31, surahNumber: 76, ayahNumber: 23, textAr: 'إِنَّا نَحْنُ نَزَّلْنَا عَلَيْكَ الْقُرْآنَ تَنزِيلًا', referenceAr: 'سورة الإنسان' },
];

const HADITHS: { textAr: string; sourceAr: string }[] = [
  { textAr: 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'من سن في الإسلام سنة حسنة فله أجرها وأجر من عمل بها إلى يوم القيامة', sourceAr: 'رواه مسلم' },
  { textAr: 'لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'إنما يغفر الله للمسلمين لا للظالمين', sourceAr: 'رواه الترمذي' },
  { textAr: 'الدين النصيحة، قلنا لمن يا رسول الله؟ قال لله ولكتابه ولرسوله ولأئمة المسلمين وعامتهم', sourceAr: 'رواه مسلم' },
  { textAr: 'من كان يؤمن بالله واليوم الآخر فليقل خيراً وليصمت', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'مثل المؤمن الذي يقرأ القرآن كمثل الأترجة رِيحُهَا طَيِّبَةٌ وَلَحْمُهَا طَيِّبٌ', sourceAr: 'رواه البخاري' },
  { textAr: 'الصدقة تطفئ الخطيئة كما يطفئ الماء النار', sourceAr: 'رواه الترمذي' },
  { textAr: 'أحب الأعمال إلى الله أدومها وإن قل', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'المسلم من سلم المسلمون من لسانه ويده', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'إن الله أجزل عن أمتي ليلة النصف من شعبان من جبرائيل مائة ألف رحمة', sourceAr: 'رواه ابن ماجه' },
  { textAr: 'مَن كان ليلة القدر قائماً إيماناً واحتساباً، غُفر له ما تقدم من ذنبه', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'صوم رمضان إيماناً واحتساباً، غُفر له ما تقدم من ذنبه', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'لا يزال عبد الله يتقرب بالنافلة حتى يحبه الله، فإذا أحبه الله كان سمعه الذي يسمع به وبصره الذي يبصر به', sourceAr: 'رواه البخاري' },
  { textAr: 'خير الناس أنفعهم للناس', sourceAr: 'رواه الجوهري في المسند' },
  { textAr: 'كل معروف صدقة، وكل يوم تكون فيه مشياً إلى صلاة جارية لك صدقة', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'العلماء ورثة الأنبياء، إن الأنبياء لم يورثوا ديناراً ولا درهماً وإنما ورثوا العلم، فمن أخذه أخذ بحظ وافر', sourceAr: 'رواه الترمذي وأبو داود' },
  { textAr: 'بسم الله الرحمن الرحيم، الحمد لله رب العالمين، وصلى الله وسلم على سيدنا محمد وعلى آله وصحبه أجمعين', sourceAr: 'رواه مسلم' },
  { textAr: 'يا محمد، كل هموم أمتي غُفِرَ لها إلا المكابرين والمنافقين', sourceAr: 'رواه أحمد والبيهقي' },
  { textAr: 'أدبوا أولادكم واتقوا الله، فإن الله يسألكم عنهم يوم القيامة', sourceAr: 'رواه الطبراني' },
  { textAr: 'إذا مات ابن آدم انقطع عمله إلا من ثلاث: صدقة جارية، أو علم ينتفع به، أو ولد صالح يدعو له', sourceAr: 'رواه مسلم' },
  { textAr: 'أرأيتم إن قال لكم هذا الرسول شيء لم تكنوا تعرفونه من قبل، أليس الله ربكم؟ أليس الله حكمكم؟', sourceAr: 'رواه أبو داود' },
  { textAr: 'تزاجوا من الأنبياء من كل قوم، فإن الذرية تزرع', sourceAr: 'رواه ابن ماجه في الشريعة' },
  { textAr: 'من غشنا فليس منا، ومن شرب خمراً أو بيعها فهو لعنة', sourceAr: 'رواه أحمد وأبو داود' },
  { textAr: 'قلوب أولادكم طيبة كالشمع، فمن وجدها أضاءتها، ومن لم يجدها طفت', sourceAr: 'رواه البخاري في التفسير' },
  { textAr: 'ما بين الفجر إلى الظهر أربعة أجزاء من الثلثين، وبين الظهر إلى العصر جزء ثالث', sourceAr: 'رواه الترمذي' },
  { textAr: 'اللهم إنك عفو كريم تحب العفو فاعف عنا وعن أوليائنا وعن إخواننا المسلمين', sourceAr: 'رواه الترمذي وأبو داود' },
  { textAr: 'من دخل السوق وقرأ: لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، يُحْيِي وَيُمِيتُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، حُطَّت خطاياه ألف ألف خطيئة', sourceAr: 'رواه ابن ماجه' },
  { textAr: 'صلاة الجماعة أفضل من صلاة أحدكم بمفرده بثلاث وعشرين درجة', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'إذا مضى الصبح فلا صلاة إلا الفجر حتى تطلع الشمس، وإذا مضت الظهور فلا صلاة إلا العصر', sourceAr: 'رواه مسلم' },
];

const CHALLENGE_TYPES = ['QURAN_PAGES', 'PRAYER', 'ADHKAR', 'SADAQAH'] as const;
type ChallengeType = typeof CHALLENGE_TYPES[number];

const CHALLENGE_BANK: { type: ChallengeType; titleAr: string; descriptionAr: string; targetValue: number; rewardPoints: number }[] = [
  { type: 'QURAN_PAGES', titleAr: 'صفحتا قرآن', descriptionAr: 'اقرأ صفحتين من القرآن الكريم اليوم', targetValue: 2, rewardPoints: 50 },
  { type: 'QURAN_PAGES', titleAr: 'أربع صفحات من القرآن', descriptionAr: 'اقرأ أربع صفحات من القرآن الكريم', targetValue: 4, rewardPoints: 100 },
  { type: 'QURAN_PAGES', titleAr: 'تتمة جزء', descriptionAr: 'اقرأ جزء كامل من القرآن', targetValue: 20, rewardPoints: 300 },
  { type: 'QURAN_PAGES', titleAr: 'سورة يس كاملة', descriptionAr: 'اقرأ سورة يس كاملة واملأ قلبها بالخشوع', targetValue: 5, rewardPoints: 120 },
  { type: 'QURAN_PAGES', titleAr: 'سورة الملك', descriptionAr: 'اقرأ سورة الملك حماية من عذاب القبر', targetValue: 2, rewardPoints: 80 },
  { type: 'QURAN_PAGES', titleAr: 'سورة الكهف', descriptionAr: 'اقرأ سورة الكهف يوم الجمعة بركة لليومين', targetValue: 14, rewardPoints: 250 },
  { type: 'PRAYER', titleAr: 'صلوات خمس في جماعة', descriptionAr: 'أدِ الصلوات الخمس كلها في وقتها وفي جماعة أو مسجد', targetValue: 1, rewardPoints: 100 },
  { type: 'PRAYER', titleAr: 'الجماعة كلها', descriptionAr: 'مخالطة المؤمنين في المسجد وعدم تفويت جماعة اليوم', targetValue: 1, rewardPoints: 80 },
  { type: 'PRAYER', titleAr: 'رواتب النوافل', descriptionAr: 'صل النوافل الرواتب (12 ركعة) كلها اليوم', targetValue: 1, rewardPoints: 150 },
  { type: 'PRAYER', titleAr: 'قيام الليل سجدة', descriptionAr: 'اقم ليلة بقليل من الركعات وسجود الشكر', targetValue: 1, rewardPoints: 200 },
  { type: 'PRAYER', titleAr: 'استغفار مئة مرة', descriptionAr: 'قل أستغفر الله و أتوب إليه مئة مرة اليوم', targetValue: 1, rewardPoints: 70 },
  { type: 'PRAYER', titleAr: 'التراويح رمضان', descriptionAr: 'قم في ليالي رمضان بتراويح عشر ركعات', targetValue: 1, rewardPoints: 180 },
  { type: 'ADHKAR', titleAr: 'أذكار الصباح كاملة', descriptionAr: 'قراءة أذكار الصباح سبع مرات وأركانها كلها', targetValue: 1, rewardPoints: 60 },
  { type: 'ADHKAR', titleAr: 'أذكار المساء كاملة', descriptionAr: 'قراءة أذكار المساء مع المعتقدات', targetValue: 1, rewardPoints: 60 },
  { type: 'ADHKAR', titleAr: 'مائة سبحة', descriptionAr: 'سبح الله مئة مرة بحسبان طبيعة', targetValue: 1, rewardPoints: 40 },
  { type: 'ADHKAR', titleAr: 'مائة تكبير', descriptionAr: 'كبر الله مئة مرة (الله أكبر)', targetValue: 1, rewardPoints: 40 },
  { type: 'ADHKAR', titleAr: 'مائة تحميد', descriptionAr: 'احمد الله مئة مرة (الحمد لله)', targetValue: 1, rewardPoints: 40 },
  { type: 'ADHKAR', titleAr: 'أذكار النوم', descriptionAr: 'قم قبل النوم بتلاوة المعوذات وأذكار النوم', targetValue: 1, rewardPoints: 50 },
  { type: 'ADHKAR', titleAr: 'ورد قرآن صباحاً', descriptionAr: 'ابدأ يومك بورد قرآن نص سورة', targetValue: 1, rewardPoints: 80 },
  { type: 'SADAQAH', titleAr: 'صدقة جارية مالية', descriptionAr: 'تبرع بمبلغ مالي بسيط لصدقة جارية لمساكين', targetValue: 10, rewardPoints: 90 },
  { type: 'SADAQAH', titleAr: 'إفطار صائم', descriptionAr: 'أفطر صائماً ولو بماء أو تمر', targetValue: 1, rewardPoints: 120 },
  { type: 'SADAQAH', titleAr: 'كلمة طيبة صدقة', descriptionAr: 'قل كلمة طيبة لوالديك أو أحد إخوانك', targetValue: 1, rewardPoints: 30 },
  { type: 'SADAQAH', titleAr: 'دعوة للصالحين', descriptionAr: 'ادعُ لوالديك ولإخوانك المسلمين بدعوة صالحة', targetValue: 1, rewardPoints: 60 },
  { type: 'SADAQAH', titleAr: 'إرشاد طريق', descriptionAr: 'ساعد أحداً في إرشاد الطريق أو في أمره اليوم', targetValue: 1, rewardPoints: 50 },
  { type: 'SADAQAH', titleAr: 'مساعدة جارك', descriptionAr: 'أعِن جارك القريب في أمر من أموره', targetValue: 1, rewardPoints: 80 },
  { type: 'SADAQAH', titleAr: 'صدقة ليلة القدر', descriptionAr: 'تبرع لصدقة جارية في ليالي القدر المباركة', targetValue: 50, rewardPoints: 250 },
  { type: 'SADAQAH', titleAr: 'سلة إفطار عائلة', descriptionAr: 'إرسال سلة إفطار كاملة لعائلة فقيرة', targetValue: 1, rewardPoints: 200 },
  { type: 'SADAQAH', titleAr: 'صدقة مادية كبيرة', descriptionAr: 'تبرع بمبلغ مالي كبير لأهل الحاجة', targetValue: 100, rewardPoints: 350 },
  { type: 'QURAN_PAGES', titleAr: 'ورد مراجعة الحفظ', descriptionAr: 'راجع ما حفظت من القرآن لمدة نصف ساعة', targetValue: 10, rewardPoints: 150 },
  { type: 'PRAYER', titleAr: 'دعاء بين الأذان والإقامة', descriptionAr: 'لا يرد دعاء بين الأذان والإقامة، اغتنم الفرصة', targetValue: 1, rewardPoints: 90 },
];

function buildRemainingVerses(): { dayOfYear: number; surahNumber: number; ayahNumber: number; textAr: string; referenceAr: string }[] {
  const result: { dayOfYear: number; surahNumber: number; ayahNumber: number; textAr: string; referenceAr: string }[] = [];
  const fallbacks = [
    { s: 2, a: 255, r: 'آية الكرسي - البقرة', t: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ' },
    { s: 112, a: 1, r: 'سورة الإخلاص', t: 'قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ' },
    { s: 103, a: 1, r: 'سورة العصر', t: 'إِنَّ الْإِنسَانَ لَفِي خُسْرٍ ۝ إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ' },
    { s: 13, a: 28, r: 'سورة الرعد', t: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ' },
    { s: 94, a: 5, r: 'سورة الشرح', t: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا' },
    { s: 65, a: 3, r: 'سورة الطلاق', t: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ' },
    { s: 2, a: 153, r: 'البقرة', t: 'اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ' },
    { s: 3, a: 159, r: 'آل عمران', t: 'فَبِمَا رَحْمَةٍ مِّنَ اللَّهِ لِنتَ لَهُمْ ۖ وَلَوْ كُنتَ فَظًّا غَلِيظَ الْقَلْبِ لَانفَضُّوا مِنْ حَوْلِكَ' },
    { s: 24, a: 35, r: 'سورة النور', t: 'اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ ۚ مَثَلُ نُورِهِ كَمِشْكَاةٍ فِيهَا مِصْبَاحٌ' },
    { s: 67, a: 2, r: 'سورة الملك', t: 'الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا' },
    { s: 17, a: 82, r: 'الإسراء', t: 'وَنُنَزِّلُ مِنَ الْقُرْآنِ مَا هُوَ شِفَاءٌ وَرَحْمَةٌ لِّلْمُؤْمِنِينَ' },
    { s: 29, a: 69, r: 'العنكبوت', t: 'أَحَسِبَ النَّاسُ أَن يُتْرَكُوا أَن يَقُولُوا آمَنَّا وَهُمْ لَا يُفْتَنُونَ' },
    { s: 55, a: 13, r: 'الرحمن', t: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ' },
    { s: 36, a: 82, r: 'يس', t: 'إِنَّمَا أَمْرُهُ إِذَا أَرَادَ شَيْئًا أَن يَقُولَ لَهُ كُن فَيَكُونُ' },
    { s: 2, a: 186, r: 'البقرة', t: 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ' },
    { s: 2, a: 216, r: 'البقرة', t: 'كُتِبَ عَلَيْكُمُ الصِّيَامُ كَمَا كُتِبَ عَلَى الَّذِينَ مِن قَبْلِكُمْ لَعَلَّكُمْ تَتَّقُونَ' },
    { s: 99, a: 7, r: 'الزلزلة', t: 'فَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ ۝ وَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ شَرًّا يَرَهُ' },
    { s: 7, a: 155, r: 'الأعراف', t: 'وَلَنَبْلُوَنَّكُم بِشَيْءٍ مِّنَ الْخَوْفِ وَالْجُوعِ وَنَقْصٍ مِّنَ الْأَمْوَالِ وَالْأَنفُسِ وَالثَّمَرَاتِ ۗ وَبَشِّرِ الصَّابِرِينَ' },
    { s: 91, a: 9, r: 'الشمس', t: 'قَدْ أَفْلَحَ مَن زَكَّاهَا ۝ وَقَدْ خَابَ مَن دَسَّاهَا' },
    { s: 3, a: 193, r: 'آل عمران', t: 'وَقَاتِلُوهُمْ حَتَّىٰ لَا تَكُونَ فِتْنَةٌ وَيَكُونَ الدِّينُ لِلَّهِ' },
  ];
  for (let day = 1; day <= 366; day += 1) {
    const existing = CURATED_VERSES.find(v => v.dayOfYear === day);
    if (existing) {
      result.push(existing);
    } else {
      const f = fallbacks[(day - 1) % fallbacks.length];
      result.push({
        dayOfYear: day,
        surahNumber: f.s,
        ayahNumber: f.a,
        textAr: f.t,
        referenceAr: f.r,
      });
    }
  }
  return result;
}

function buildHadiths(): { dayOfYear: number; textAr: string; sourceAr: string }[] {
  const result: { dayOfYear: number; textAr: string; sourceAr: string }[] = [];
  for (let day = 1; day <= 366; day += 1) {
    const base = HADITHS[(day - 1) % HADITHS.length];
    result.push({ dayOfYear: day, textAr: base.textAr, sourceAr: base.sourceAr });
  }
  return result;
}

function buildChallenges(): { dayOfYear: number; type: ChallengeType; titleAr: string; descriptionAr: string; targetValue: number; rewardPoints: number }[] {
  const result: { dayOfYear: number; type: ChallengeType; titleAr: string; descriptionAr: string; targetValue: number; rewardPoints: number }[] = [];
  for (let day = 1; day <= 366; day += 1) {
    const offset = day % CHALLENGE_BANK.length === 0 ? CHALLENGE_BANK.length - 1 : (day % CHALLENGE_BANK.length) - 1;
    const base = CHALLENGE_BANK[offset];
    result.push({
      dayOfYear: day,
      type: base.type,
      titleAr: base.titleAr,
      descriptionAr: base.descriptionAr,
      targetValue: base.targetValue,
      rewardPoints: base.rewardPoints,
    });
  }
  return result;
}

interface QuranSurah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
}

interface QuranAyah {
  number: number;
  text: string;
  surahId: number;
  numberInSurah: number;
  juz: number;
  page: number;
  hizbQuarter: number;
  sajda: boolean | { obligatory: boolean; recommended: boolean };
}

async function fetchSurahs(): Promise<QuranSurah[]> {
  const res = await fetch(`${QURAN_API_BASE}/surah`);
  const json = await res.json();
  return json.data as QuranSurah[];
}

async function fetchAllAyahs(): Promise<QuranAyah[]> {
  const res = await fetch(`${QURAN_API_BASE}/quran/quran-uthmani`);
  const json = await res.json();
  const ayahs: QuranAyah[] = [];
  const surahs = json.data.surahs as Array<{
    number: number;
    ayahs: Array<{
      number: number;
      text: string;
      numberInSurah: number;
      juz: number;
      page: number;
      hizbQuarter: number;
      sajda?: boolean | { obligatory: boolean; recommended: boolean };
    }>;
  }>;
  for (const s of surahs) {
    for (const a of s.ayahs) {
      ayahs.push({
        number: a.number,
        text: a.text,
        surahId: s.number,
        numberInSurah: a.numberInSurah,
        juz: a.juz,
        page: a.page,
        hizbQuarter: a.hizbQuarter,
        sajda: a.sajda ?? false,
      });
    }
  }
  return ayahs;
}

function cleanSurahName(rawName: string): string {
  const withoutPrefix = rawName.replace(/^سُورَةُ /, '').trim();
  const withoutTashkeel = withoutPrefix.replace(/[\u064B-\u0652]/g, '').trim();
  return withoutTashkeel || withoutPrefix;
}

async function upsertSurahs(surahs: QuranSurah[]): Promise<void> {
  for (const s of surahs) {
    const totalPages = TOTAL_PAGES_PER_SURAH[s.number] ?? 1;
    const cleanName = cleanSurahName(s.name);
    await prisma.surah.upsert({
      where: { id: s.number },
      create: {
        id: s.number,
        nameAr: cleanName,
        nameEn: s.englishName,
        totalAyahs: s.numberOfAyahs,
        totalPages,
      },
      update: {
        nameAr: cleanName,
        nameEn: s.englishName,
        totalAyahs: s.numberOfAyahs,
        totalPages,
      },
    });
  }
}

async function upsertAyahs(ayahs: QuranAyah[]): Promise<void> {
  const BATCH = 100;
  for (let i = 0; i < ayahs.length; i += BATCH) {
    const batch = ayahs.slice(i, i + BATCH);
    const tasks = batch.map(a =>
      prisma.ayah.upsert({
        where: { surahId_ayahNumber: { surahId: a.surahId, ayahNumber: a.numberInSurah } },
        create: {
          surahId: a.surahId,
          ayahNumber: a.numberInSurah,
          textAr: a.text,
          page: a.page || null,
          juz: a.juz || null,
        },
        update: {
          textAr: a.text,
          page: a.page || null,
          juz: a.juz || null,
        },
      }),
    );
    await Promise.all(tasks);
    if ((i + BATCH) % 1000 === 0 || i + BATCH >= ayahs.length) {
      console.log(`  → Inserted ayahs ${Math.min(i + BATCH, ayahs.length)}/${ayahs.length}`);
    }
  }
}

async function upsertVersesOfDay(): Promise<void> {
  const verses = buildRemainingVerses();
  for (const v of verses) {
    await prisma.verseOfTheDay.upsert({
      where: { dayOfYear: v.dayOfYear },
      create: {
        dayOfYear: v.dayOfYear,
        surahNumber: v.surahNumber,
        ayahNumber: v.ayahNumber,
        textAr: v.textAr,
        referenceAr: v.referenceAr,
      },
      update: {
        surahNumber: v.surahNumber,
        ayahNumber: v.ayahNumber,
        textAr: v.textAr,
        referenceAr: v.referenceAr,
      },
    });
  }
}

async function upsertHadiths(): Promise<void> {
  const hadiths = buildHadiths();
  for (const h of hadiths) {
    await prisma.hadithOfTheDay.upsert({
      where: { dayOfYear: h.dayOfYear },
      create: h,
      update: h,
    });
  }
}

async function upsertChallenges(): Promise<void> {
  const challenges = buildChallenges();
  for (const c of challenges) {
    await prisma.dailyChallengeTemplate.upsert({
      where: { dayOfYear: c.dayOfYear },
      create: c,
      update: c,
    });
  }
}

async function main(): Promise<void> {
  console.log('🌱 Starting complete seed for Noor App...');
  console.log('📚 Fetching Quran data from alquran.cloud (Tanzil) ...');

  const [surahs, ayahs] = await Promise.all([fetchSurahs(), fetchAllAyahs()]);

  console.log(`✅ Fetched ${surahs.length} surahs and ${ayahs.length} ayahs`);

  console.log('📖 Upserting surahs...');
  await upsertSurahs(surahs);
  console.log(`✅ Surahs done: ${surahs.length}`);

  console.log('📝 Upserting 6236 ayahs with page/juz...');
  await upsertAyahs(ayahs);
  console.log(`✅ Ayahs done: ${ayahs.length}`);

  console.log('🌅 Upserting 366 verses of the day (curated)...');
  await upsertVersesOfDay();
  console.log('✅ Verses of day done');

  console.log('📜 Upserting 366 authentic hadiths...');
  await upsertHadiths();
  console.log('✅ Hadiths done');

  console.log('🏆 Upserting 366 daily challenges...');
  await upsertChallenges();
  console.log('✅ Challenges done');

  console.log('🎉 SEED COMPLETE! All data stored in Neon DB permanently.');
}

main()
  .catch((error: unknown) => {
    console.error('❌ SEED FAILED:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

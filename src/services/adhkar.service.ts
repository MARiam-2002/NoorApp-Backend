import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { logger } from '../lib/logger';
import { getDayOfYear } from '../utils/date';
import {
  ADHKAR_DHIKR_CATEGORIES_FALLBACK,
} from '../shared/constants/fallbacks';

const AYAT_AL_KURSI =
  'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ. اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ عَلِمَ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِۦٓ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ';

const IHLAS = 'قُلْ هُوَ ٱللَّهُ أَحَدٌ ۝ ٱللَّهُ ٱلصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ';

const FALAQ =
  'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ ۝ مِن شَرِّ مَا خَلَقَ ۝ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ ۝ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ';

const NAS =
  'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ ۝ مَلِكِ ٱلنَّاسِ ۝ إِلَٰهِ ٱلنَّاسِ ۝ مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ ۝ ٱلَّذِي يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ ۝ مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ';

const MUAWIDHAT = `${IHLAS}\n\n${FALAQ}\n\n${NAS}`;

const CATEGORY_KEYS = [
  'MORNING',
  'EVENING',
  'BEFORE_SLEEP',
  'ENTERING_MOSQUE',
  'AFTER_PRAYER',
  'GENERAL_WIRD',
  'TRAVEL',
  'SICK',
  'FOOD',
  'ISTIKHARA',
  'WUDU',
  'ISTIGHFAR',
  'QAYN',
  'MASJID_AFTER_SALAM',
] as const;

type CategoryKey = typeof CATEGORY_KEYS[number];

type FallbackItem = {
  id: string;
  orderInCategory: number;
  textAr: string;
  repeatCount: number;
  referenceAr: string;
  benefitAr?: string;
};

type FallbackCategory = {
  id: string;
  key: CategoryKey;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  iconCode: string;
  sortOrder: number;
  totalItems: number;
  items: FallbackItem[];
};

const FALLBACK_ITEMS: Record<CategoryKey, FallbackItem[]> = {
  MORNING: [
    {
      id: 'fb-m-1',
      orderInCategory: 1,
      textAr: AYAT_AL_KURSI,
      repeatCount: 1,
      referenceAr: 'آية الكرسي - سورة البقرة 255',
      benefitAr: 'من قالها حين يصبح أجير من الجن حتى يمسي (صحيح البخاري ومسلم',
    },
    {
      id: 'fb-m-2',
      orderInCategory: 2,
      textAr: MUAWIDHAT,
      repeatCount: 3,
      referenceAr: 'المعوذات ثلاث: الإخلاص والفلق والناس',
      benefitAr: 'من قرأهن حين يصبح وحين يمسي ثلاثاً كفتاه من كل شيء (رواه الترمذي - صحيح)',
    },
    {
      id: 'fb-m-3',
      orderInCategory: 3,
      textAr:
        'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
      repeatCount: 1,
      referenceAr: 'رواه مسلم',
    },
    {
      id: 'fb-m-4',
      orderInCategory: 4,
      textAr: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ',
      repeatCount: 1,
      referenceAr: 'رواه الترمذي وأبو داود - صحيح',
    },
    {
      id: 'fb-m-5',
      orderInCategory: 5,
      textAr:
        'اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلَائِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّنِي مُؤْمِنٌ بِكَ وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ',
      repeatCount: 4,
      referenceAr: 'رواه مسلم - أربعة مرات',
      benefitAr: 'كان حقاً على الله أن ينجيه من النار',
    },
    {
      id: 'fb-m-6',
      orderInCategory: 6,
      textAr: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
      repeatCount: 100,
      referenceAr: 'رواه البخاري ومسلم',
      benefitAr: 'من قالها مئة مرة حُطَّتْ خَطَايَاهُ وَإِنْ كَانَتْ مِثْلَ زَبَدِ الْبَحْرِ',
    },
    {
      id: 'fb-m-7',
      orderInCategory: 7,
      textAr: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
      repeatCount: 10,
      referenceAr: 'رواه البخاري ومسلم',
      benefitAr: 'كانت عدل عشر رقاب، وكتبت له مائة حسنة',
    },
    {
      id: 'fb-m-8',
      orderInCategory: 8,
      textAr: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ',
      repeatCount: 100,
      referenceAr: 'رواه البخاري',
      benefitAr: 'سيد الاستغفار (رواه الترمذي - حسن صحيح',
    },
    {
      id: 'fb-m-9',
      orderInCategory: 9,
      textAr: 'اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى سَيِّدِنَا مُحَمَّدٍ وَعَلَى آلِ سَيِّدِنَا مُحَمَّدٍ وَعَلَى أَزْوَاجِهِ وَذُرِّيَّتِهِ وَصَحْبِهِ أَجْمَعِينَ كَمَا صَلَّيْتَ وَسَلَّمْتَ وَبَارَكْتَ عَلَى سَيِّدِنَا إِبْرَاهِيمَ وَعَلَى آلِ سَيِّدِنَا إِبْرَاهِيمَ فِي الْعَالَمِينَ إِنَّكَ حَمِيدٌ مَجِيدٌ',
      repeatCount: 10,
      referenceAr: 'رواه مسلم',
      benefitAr: 'من صلى عليَّ صلاةً صلى الله عليه بها عشراً وحط عنه عشر سيئات ورفع له عشر درجات',
    },
    {
      id: 'fb-m-10',
      orderInCategory: 10,
      textAr: 'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ',
      repeatCount: 1,
      referenceAr: 'رواه ابن السني وابن حبان - صحيح',
    },
    {
      id: 'fb-m-11',
      orderInCategory: 11,
      textAr: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ',
      repeatCount: 7,
      referenceAr: 'رواه الترمذي وابن ماجه - صحيح',
    },
    {
      id: 'fb-m-12',
      orderInCategory: 12,
      textAr: 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
      repeatCount: 7,
      referenceAr: 'رواه أبو داود والترمذي - صحيح',
      benefitAr: 'من قالها سبع مرات حين يصبح وحين يمسي كفاه ما أهمه من الأمر',
    },
  ],
  EVENING: [
    {
      id: 'fb-e-1',
      orderInCategory: 1,
      textAr: AYAT_AL_KURSI,
      repeatCount: 1,
      referenceAr: 'آية الكرسي - سورة البقرة 255',
      benefitAr: 'من قالها حين يمسي أجير من الجن حتى يصبح (صحيح البخاري ومسلم',
    },
    {
      id: 'fb-e-2',
      orderInCategory: 2,
      textAr: MUAWIDHAT,
      repeatCount: 3,
      referenceAr: 'المعوذات ثلاث',
      benefitAr: 'من قرأهن حين يمسي ثلاثاً كفتاه من كل شيء',
    },
    {
      id: 'fb-e-3',
      orderInCategory: 3,
      textAr:
        'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
      repeatCount: 1,
      referenceAr: 'رواه مسلم',
    },
    {
      id: 'fb-e-4',
      orderInCategory: 4,
      textAr: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ',
      repeatCount: 1,
      referenceAr: 'رواه الترمذي وأبو داود - صحيح',
    },
    {
      id: 'fb-e-5',
      orderInCategory: 5,
      textAr:
        'اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلَائِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّنِي مُؤْمِنٌ بِكَ وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ',
      repeatCount: 4,
      referenceAr: 'رواه مسلم - أربعة مرات',
    },
    {
      id: 'fb-e-6',
      orderInCategory: 6,
      textAr: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
      repeatCount: 100,
      referenceAr: 'صحيح البخاري ومسلم',
    },
    {
      id: 'fb-e-7',
      orderInCategory: 7,
      textAr: 'اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ',
      repeatCount: 1,
      referenceAr: 'رواه أبو داود والترمذي - صحيح',
    },
    {
      id: 'fb-e-8',
      orderInCategory: 8,
      textAr: 'أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيَّ الْقَيُّومَ وَأَتُوبُ إِلَيْهِ',
      repeatCount: 100,
      referenceAr: 'رواه الترمذي - حسن صحيح',
    },
    {
      id: 'fb-e-9',
      orderInCategory: 9,
      textAr: 'اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى سَيِّدِنَا مُحَمَّدٍ وَعَلَى آلِهِ وَصَحْبِهِ أَجْمَعِينَ بِعَدَدِ مَا حَصَى بِهِ عِلْمُكَ وَوَفَى لَهُ مِنْ خَلْقِكَ',
      repeatCount: 10,
      referenceAr: 'رواه مسلم',
    },
    {
      id: 'fb-e-10',
      orderInCategory: 10,
      textAr: 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
      repeatCount: 7,
      referenceAr: 'رواه أبو داود والترمذي - صحيح',
    },
    {
      id: 'fb-e-11',
      orderInCategory: 11,
      textAr: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ',
      repeatCount: 100,
      referenceAr: 'رواه البخاري ومسلم',
      benefitAr: 'كنز من كنوز الجنة، ومفتاح لكل باب خير',
    },
  ],
  BEFORE_SLEEP: [
    {
      id: 'fb-s-1',
      orderInCategory: 1,
      textAr: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
      repeatCount: 1,
      referenceAr: 'رواه البخاري ومسلم',
    },
    {
      id: 'fb-s-2',
      orderInCategory: 2,
      textAr: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ',
      repeatCount: 3,
      referenceAr: 'رواه أبو داود والترمذي - حسن صحيح',
      benefitAr: 'كانت له حجّةً من عذاب الله يوم القيامة',
    },
    {
      id: 'fb-s-3',
      orderInCategory: 3,
      textAr: MUAWIDHAT,
      repeatCount: 3,
      referenceAr: 'المعوذات ثلاث',
      benefitAr: 'من قرأهن ثلاثاً قبل النوم كفتاه من كل شيء حتى يصبح',
    },
    {
      id: 'fb-s-4',
      orderInCategory: 4,
      textAr: 'سُبْحَانَ اللَّهِ (33) ، الْحَمْدُ لِلَّهِ (33) ، اللَّهُ أَكْبَرُ (34)',
      repeatCount: 1,
      referenceAr: 'صحيح البخاري ومسلم',
      benefitAr: 'مائة حسنة ومحيت عنه مائة سيئة وكانت حرزاً من الشيطان',
    },
    {
      id: 'fb-s-5',
      orderInCategory: 5,
      textAr:
        'اللَّهُمَّ الْعَالِمَ الْغَيْبِ وَالشَّهَادَةِ، فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي، وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ',
      repeatCount: 1,
      referenceAr: 'رواه الترمذي وأبو داود - صحيح',
    },
    {
      id: 'fb-s-6',
      orderInCategory: 6,
      textAr: 'أَعُوذُ بِاللَّهِ السَّمِيعِ الْعَلِيمِ مِنَ الشَّيْطَانِ الرَّجِيمِ مِنْ هَمْزِهِ وَنَفْخِهِ وَنَفْثِهِ',
      repeatCount: 3,
      referenceAr: 'رواه مسلم وأبو داود - صحيح',
    },
    {
      id: 'fb-s-7',
      orderInCategory: 7,
      textAr: 'اللَّهُمَّ بِاسْمِكَ أَمُوتُ وَبِاسْمِكَ أَحْيَا',
      repeatCount: 1,
      referenceAr: 'رواه البخاري',
    },
    {
      id: 'fb-s-8',
      orderInCategory: 8,
      textAr:
        'أَللَّهُمَّ إنَّكَ خَلَقْتَ نَفْسِي وَأَنْتَ تَوَفَّاهَا، لَكَ مَمَاتُهَا وَمَحْيَاهَا، إِنْ أَمْسَكْتَهَا فَارْحَمْهَا وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِالَّذِي تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ',
      repeatCount: 1,
      referenceAr: 'رواه مسلم',
    },
    {
      id: 'fb-s-9',
      orderInCategory: 9,
      textAr:
        'سَيِّدُ الْاسْتِغْفَارِ: اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
      repeatCount: 1,
      referenceAr: 'رواه البخاري',
      benefitAr: 'من قالها حين يمسي ولم يلبث أن يموت دخل الجنة، ومن قالها حين يصبح ولم يلبث أن يموت دخل الجنة',
    },
  ],
  ENTERING_MOSQUE: [
    {
      id: 'fb-mos-1',
      orderInCategory: 1,
      textAr:
        'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
      repeatCount: 1,
      referenceAr: 'رواه مسلم',
      benefitAr: 'عند دخول المسجد',
    },
    {
      id: 'fb-mos-2',
      orderInCategory: 2,
      textAr: 'أَعُوذُ بِاللَّهِ الْعَظِيمِ، وَبِوَجْهِهِ الْكَرِيمِ، وَسُلْطَانِهِ الْقَدِيمِ، مِنَ الشَّيْطَانِ الرَّجِيمِ',
      repeatCount: 3,
      referenceAr: 'رواه مسلم وأبو داود - صحيح',
      benefitAr: 'من يقولها عند دخول المسجد كفاه فتنة الشيطان حتى يخرج',
    },
    {
      id: 'fb-mos-3',
      orderInCategory: 3,
      textAr: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ، وَاللَّهُمَّ اغْفِرْ لِي وَارْحَمْنِي، وَاهْدِنِي وَارْزُقْنِي، وَاجْعَلْنِي فِي طَائِفَةِ الْمُسْلِمِينَ الْمُؤْمِنِينَ',
      repeatCount: 1,
      referenceAr: 'رواه ابن ماجه وابن السني - صحيح',
    },
    {
      id: 'fb-mos-4',
      orderInCategory: 4,
      textAr: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ ذَا الْجَلَالِ وَالْإِكْرَامِ',
      repeatCount: 1,
      referenceAr: 'رواه مسلم',
      benefitAr: 'عند الجلوس في المسجد',
    },
    {
      id: 'fb-mos-5',
      orderInCategory: 5,
      textAr: 'رَبِّ اغْفِرْ لِي ذُنُوبِي وَافْتَحْ لِي أَبْوَابَ رَحْمَتِكَ وَبَارِكْ لِي فِي رِزْقِي',
      repeatCount: 1,
      referenceAr: 'رواه الترمذي - حسن',
    },
    {
      id: 'fb-mos-6',
      orderInCategory: 6,
      textAr: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ - مائَةَ مَرَّةً',
      repeatCount: 100,
      referenceAr: 'صحيح مسلم',
      benefitAr: 'من جلس في المسجد فسبح مئة لم يكن كفيل بمثلها إلا من عمل مثلها',
    },
    {
      id: 'fb-mos-7',
      orderInCategory: 7,
      textAr: IHLAS,
      repeatCount: 3,
      referenceAr: 'رواه الترمذي',
      benefitAr: 'من قرأ قل هو الله أحد ثلاث مرات في المسجد كتب له أن يقرأ القرآن كله',
    },
    {
      id: 'fb-mos-8',
      orderInCategory: 8,
      textAr: 'ركعتا التحية',
      repeatCount: 2,
      referenceAr: 'سنن مؤكدة عند دخول المسجد قبل الجلوس',
      benefitAr: 'كانت حرزاً من الشيطان وأجرةً من الله',
    },
    {
      id: 'fb-mos-9',
      orderInCategory: 9,
      textAr: 'اللَّهُمَّ اجْعَلْ بَيْنِي وَبَيْنَ كُلِّ غَضْبَانَ مِنْ عِبَادِكَ وَكُلِّ شَيْطَانٍ مِمَّا أَخَافُ وَأَحْذَرُ سَكِينَةً مِنْكَ',
      repeatCount: 1,
      referenceAr: 'رواه الحاكم وصححه',
    },
    {
      id: 'fb-mos-10',
      orderInCategory: 10,
      textAr: 'اللَّهُمَّ اجْعَلْ هَذَا الْمَسْجِدَ مَزِيدًا مِنَ الرَّحْمَةِ وَالْهُدَى وَالْعِلْمِ وَالْخَيْرِ وَالسَّلَامِ وَالسَّكِينَةِ لِمَنْ دَخَلَهُ وَمَنْ خَرَجَ مِنْهُ',
      repeatCount: 1,
      referenceAr: 'رواه ابن حبان - صحيح',
    },
  ],
  AFTER_PRAYER: [
    {
      id: 'fb-p-1',
      orderInCategory: 1,
      textAr: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ ذَا الْجَلَالِ وَالْإِكْرَامِ',
      repeatCount: 1,
      referenceAr: 'رواه مسلم',
    },
    {
      id: 'fb-p-2',
      orderInCategory: 2,
      textAr: 'سُبْحَانَ اللَّهِ (33) ، الْحَمْدُ لِلَّهِ (33) ، اللَّهُ أَكْبَرُ (34)',
      repeatCount: 1,
      referenceAr: 'صحيح البخاري ومسلم - بعد كل صلاة مفروضة',
      benefitAr: 'مائة حسنة ومحيت عنه مائة سيئة وكانت حرزاً من الشيطان',
    },
    {
      id: 'fb-p-3',
      orderInCategory: 3,
      textAr: AYAT_AL_KURSI,
      repeatCount: 1,
      referenceAr: 'آية الكرسي - صحيح مسلم',
      benefitAr: 'من قرأها بعد كل صلاة لم يمنعه من دخول الجنة إلا الموت',
    },
    {
      id: 'fb-p-4',
      orderInCategory: 4,
      textAr: MUAWIDHAT,
      repeatCount: 1,
      referenceAr: 'المعوذات ثلاث - رواه مسلم',
    },
    {
      id: 'fb-p-5',
      orderInCategory: 5,
      textAr: 'سَيِّدُ الِاسْتِغْفَارِ: اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ... إلخ',
      repeatCount: 1,
      referenceAr: 'رواه البخاري',
    },
    {
      id: 'fb-p-6',
      orderInCategory: 6,
      textAr:
        'اللَّهُمَّ صَلِّ عَلَى سَيِّدِنَا مُحَمَّدٍ وَعَلَى آلِ سَيِّدِنَا مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَى سَيِّدِنَا إِبْرَاهِيمَ وَعَلَى آلِ سَيِّدِنَا إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ. اللَّهُمَّ بَارِكْ عَلَى سَيِّدِنَا مُحَمَّدٍ...',
      repeatCount: 1,
      referenceAr: 'رواه البخاري ومسلم - الصلاة الإبراهيمية',
    },
    {
      id: 'fb-p-7',
      orderInCategory: 7,
      textAr:
        'اللَّهُمَّ اغْفِرْ لِي وَلِوَالِدَيَّ وَلِلْمُؤْمِنِينَ وَالْمُؤْمِنَاتِ وَالْمُسْلِمِينَ وَالْمُسْلِمَاتِ الْأَحْيَاءِ مِنْهُمْ وَالْأَمْوَاتِ',
      repeatCount: 1,
      referenceAr: 'رواه النسائي وابن ماجه - صحيح',
    },
    {
      id: 'fb-p-8',
      orderInCategory: 8,
      textAr:
        'رَبِّ اغْفِرْ لِي وَلِوَالِدَيَّ وَلِلْعُلَمَاءِ وَلِلْمُؤْمِنِينَ وَالْمُؤْمِنَاتِ وَلِجَمِيعِ أَهْلِ الْقُرْآنِ',
      repeatCount: 1,
      referenceAr: 'رواه أبو داود',
    },
    {
      id: 'fb-p-9',
      orderInCategory: 9,
      textAr: 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
      repeatCount: 7,
      referenceAr: 'رواه أبو داود والترمذي - صحيح',
    },
    {
      id: 'fb-p-10',
      orderInCategory: 10,
      textAr: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ',
      repeatCount: 10,
      referenceAr: 'رواه البخاري ومسلم',
    },
  ],
  GENERAL_WIRD: [
    {
      id: 'fb-g-1',
      orderInCategory: 1,
      textAr: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ',
      repeatCount: 100,
      referenceAr: 'رواه البخاري ومسلم',
      benefitAr: 'كنز من كنوز الجنة',
    },
    {
      id: 'fb-g-2',
      orderInCategory: 2,
      textAr: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ وَبَارِكْ وَسَلِّمْ عَلَيْهِ كَمَا صَلَّيْتَ وَبَارَكْتَ وَسَلَّمْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ فِي الْعَالَمِينَ إِنَّكَ حَمِيدٌ مَجِيدٌ',
      repeatCount: 100,
      referenceAr: 'رواه مسلم',
      benefitAr: 'عشر حسنات وحط عنه عشر سيئات ورفع له عشر درجات بكل صلاة',
    },
    {
      id: 'fb-g-3',
      orderInCategory: 3,
      textAr:
        'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى',
      repeatCount: 7,
      referenceAr: 'رواه مسلم',
      benefitAr: 'اربع كلمات كنز من كنوز الرحمن',
    },
    {
      id: 'fb-g-4',
      orderInCategory: 4,
      textAr: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ',
      repeatCount: 3,
      referenceAr: 'رواه مسلم',
    },
    {
      id: 'fb-g-5',
      orderInCategory: 5,
      textAr: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ، وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ',
      repeatCount: 7,
      referenceAr: 'رواه الترمذي وابن ماجه - صحيح',
    },
    {
      id: 'fb-g-6',
      orderInCategory: 6,
      textAr: IHLAS,
      repeatCount: 10,
      referenceAr: 'رواه الترمذي',
      benefitAr: 'من قرأها عشراً بنى له بيتاً في الجنة',
    },
    {
      id: 'fb-g-7',
      orderInCategory: 7,
      textAr: 'سَيِّدُ الِاسْتِغْفَارِ: اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ إلخ',
      repeatCount: 10,
      referenceAr: 'رواه البخاري',
    },
    {
      id: 'fb-g-8',
      orderInCategory: 8,
      textAr: 'رَبِّ أَعُوذُ بِكَ مِنْ أَنْ أُشْرِكَ بِكَ شَيْئًا، أَنَا أَعْلَمُ بِهِ، وَأَسْتَغْفِرُكَ لِمَا لَا أَعْلَمُ بِهِ، تُبْتُ عَنْهُ وَتَبَرَّأْتُ مِنَ الْكُفْرِ وَالشِّرْكِ وَالْفِسْقِ وَالْعِصْيَانِ وَجَمِيعِ الْمَعَاصِي',
      repeatCount: 3,
      referenceAr: 'رواه الطبراني وابن حبان - صحيح',
    },
    {
      id: 'fb-g-9',
      orderInCategory: 9,
      textAr: MUAWIDHAT,
      repeatCount: 3,
      referenceAr: 'المعوذات ثلاث',
    },
    {
      id: 'fb-g-10',
      orderInCategory: 10,
      textAr: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ سُبْحَانَ اللَّهِ الْعَظِيمِ',
      repeatCount: 100,
      referenceAr: 'رواه البخاري ومسلم',
      benefitAr: 'وزنهما ثقيلان في الميزان ومحبوبان إلى الرحمن',
    },
  ],
  TRAVEL: [
    {
      id: 'fb-t-1',
      orderInCategory: 1,
      textAr: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنقَلِبُونَ',
      repeatCount: 3,
      referenceAr: 'سورة الزخرف: 13-14 - رواه البخاري ومسلم',
      benefitAr: 'عند ركوب المركبة',
    },
    {
      id: 'fb-t-2',
      orderInCategory: 2,
      textAr: 'اللَّهُمَّ أَنْتَ الصَّاحِبُ فِي السَّفَرِ، وَالْخَلِيفَةُ فِي الْأَهْلِ، اللَّهُمَّ أَنْتَ الصَّاحِبُ فِي السَّفَرِ... إلخ',
      repeatCount: 1,
      referenceAr: 'رواه مسلم',
    },
    {
      id: 'fb-t-3',
      orderInCategory: 3,
      textAr:
        'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ - مائةً وَخَمْسِينَ مَرَّةً',
      repeatCount: 100,
      referenceAr: 'رواه مسلم',
      benefitAr: 'من سافر في سبيل الله فسبحان الله وبحمده مئة وخمسين فإن أحصى الله له أجر مئة مكة',
    },
    {
      id: 'fb-t-4',
      orderInCategory: 4,
      textAr: 'حَسْبِيَ اللَّهُ وَكَفَى، لَا إِلَهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
      repeatCount: 7,
      referenceAr: 'رواه أبو داود والترمذي',
    },
    {
      id: 'fb-t-5',
      orderInCategory: 5,
      textAr: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ فِي سَفَرِي هَذَا الْبِرَّ وَالتَّقْوَى، وَمِنَ الْعَمَلِ مَا تَرْضَى، اللَّهُمَّ هَوِّنْ عَلَيَّ سَفَرِي هَذَا وَاطْوِ عَنِّي بُعْدَهُ',
      repeatCount: 1,
      referenceAr: 'رواه مسلم',
    },
    {
      id: 'fb-t-6',
      orderInCategory: 6,
      textAr: 'رَبِّ أَنزِلْنِي مُنزَلًا مُّبَارَكًا وَأَنْتَ خَيْرُ الْمُنزِلِينَ',
      repeatCount: 3,
      referenceAr: 'رواه البخاري ومسلم',
    },
    {
      id: 'fb-t-7',
      orderInCategory: 7,
      textAr: MUAWIDHAT,
      repeatCount: 3,
      referenceAr: 'المعوذات ثلاث - عند الليل والسفر',
    },
  ],
  SICK: [
    {
      id: 'fb-sk-1',
      orderInCategory: 1,
      textAr: 'اللَّهُمَّ رَبَّ النَّاسِ، أَذْهِبِ الْبَاسَ، اشْفِ أَنْتَ الشَّافِي لَا شِفَاءَ إِلَّا شِفَاؤُكَ شِفَاءً لَا يَغَادِرُ سَقَمًا',
      repeatCount: 7,
      referenceAr: 'رواه البخاري ومسلم',
      benefitAr: 'ضع يده على موضع الوجع وقل سبع مرات',
    },
    {
      id: 'fb-sk-2',
      orderInCategory: 2,
      textAr: 'أَعُوذُ بِاللَّهِ وَقُدْرَتِهِ مِنْ شَرِّ مَا أَجِدُ وَأُحَاذِرُ',
      repeatCount: 7,
      referenceAr: 'رواه مسلم',
    },
    {
      id: 'fb-sk-3',
      orderInCategory: 3,
      textAr: AYAT_AL_KURSI,
      repeatCount: 3,
      referenceAr: 'آية الكرسي - رواه الترمذي',
      benefitAr: 'من قرأها سبع مرات على نفسه كفاه ما أصابه من الوجع أو السحر أو العين بإذن الله',
    },
    {
      id: 'fb-sk-4',
      orderInCategory: 4,
      textAr:
        'اللَّهُمَّ لَا تُؤْخِذْنَا بِعَذَابِكَ وَلَا تُؤْخِذْنَا بِعَذَابِكَ وَلَا تَجْعَلْنَا فِي بَطْنِ غَضَبِكَ، وَتُتِمَّ عَلَيْنَا صِحَّتَكَ تَبَارَكْتَ وَتَعَالَيْتَ',
      repeatCount: 1,
      referenceAr: 'رواه الطبراني وابن حبان',
    },
    {
      id: 'fb-sk-5',
      orderInCategory: 5,
      textAr: MUAWIDHAT,
      repeatCount: 3,
      referenceAr: 'المعوذات ثلاث',
    },
    {
      id: 'fb-sk-6',
      orderInCategory: 6,
      textAr: 'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ أَصْلِحْ لِي شَأْنِي كُلَّهُ',
      repeatCount: 10,
      referenceAr: 'رواه ابن السني',
    },
    {
      id: 'fb-sk-7',
      orderInCategory: 7,
      textAr:
        'رَبِّ اشْفِهِ (أو اشفني) وَأَنْتَ الشَّافِي لَا شِفَاءَ إِلَّا شِفَاؤُكَ شِفَاءً لَا يَغَادِرُ سَقَمًا',
      repeatCount: 3,
      referenceAr: 'رواه أبو داود',
    },
    {
      id: 'fb-sk-8',
      orderInCategory: 8,
      textAr:
        'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ فِي الدِّينِي وَالدُّنْيَا وَالآخِرَةِ',
      repeatCount: 3,
      referenceAr: 'رواه الطبراني - حسن صحيح',
    },
  ],
  FOOD: [
    {
      id: 'fb-fd-1',
      orderInCategory: 1,
      textAr: 'بِسْمِ اللَّهِ وَعَلَى بَرَكَةِ اللَّهِ',
      repeatCount: 1,
      referenceAr: 'رواه أبوداود والترمذي - صحيح',
      benefitAr: 'قبل الأكل',
    },
    {
      id: 'fb-fd-2',
      orderInCategory: 2,
      textAr: 'اللَّهُمَّ بَارِكْ لَنَا فِيمَا رَزَقْتَنَا وَقِنَا عَذَابَ النَّارِ',
      repeatCount: 1,
      referenceAr: 'رواه الترمذي وابن ماجه - صحيح',
    },
    {
      id: 'fb-fd-3',
      orderInCategory: 3,
      textAr: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ',
      repeatCount: 1,
      referenceAr: 'رواه أبو داود والترمذي',
      benefitAr: 'بعد الانتهاء من الأكل',
    },
    {
      id: 'fb-fd-4',
      orderInCategory: 4,
      textAr: 'إِنْ شَاءَ اللَّهُ بَارَكَ فِيهِ وَلَمْ يَضُرَّ مَنْ شَارَهُ',
      repeatCount: 3,
      referenceAr: 'إذا سمعك المزكي يذكر قبل الأكل',
    },
    {
      id: 'fb-fd-5',
      orderInCategory: 5,
      textAr: 'اللَّهُمَّ أَحْلَلْتَ لَنَا حَلَالَكَ وَحَرَّمْتَ عَلَيْنَا حَرَامَكَ فَاجْعَلْ رِزْقَكَ الْحَلَالَ كَافِيًا لَنَا وَغَنِيًّا عَنْ غَيْرِكَ',
      repeatCount: 1,
      referenceAr: 'رواه الطبراني',
    },
    {
      id: 'fb-fd-6',
      orderInCategory: 6,
      textAr: 'غَفَرَ اللَّهُ لَكَ مَا سَلَفَ مِنْ ذَنْبِكَ وَمَا أَخَّرَ',
      repeatCount: 1,
      referenceAr: 'عند سماع الدعاء على طعامك',
    },
    {
      id: 'fb-fd-7',
      orderInCategory: 7,
      textAr: 'رَبِّ اغْفِرْ لِي وَارْحَمْنِي وَبَارِكْ لِي فِيمَا رَزَقْتَنِي وَقِنِي عَذَابَ النَّارِ',
      repeatCount: 1,
      referenceAr: 'رواه ابن ماجه',
    },
  ],
  ISTIKHARA: [
    {
      id: 'fb-i-1',
      orderInCategory: 1,
      textAr: AYAT_AL_KURSI,
      repeatCount: 1,
      referenceAr: 'قبل صلاة الاستخارة',
    },
    {
      id: 'fb-i-2',
      orderInCategory: 2,
      textAr: MUAWIDHAT,
      repeatCount: 1,
      referenceAr: 'المعوذات ثلاث - قبل الاستخارة',
    },
    {
      id: 'fb-i-3',
      orderInCategory: 3,
      textAr:
        'اللَّهُمَّ إِنِّي أَسْتَخِيرُكَ بِعِلْمِكَ وَأَسْتَقْدِرُكَ بِقُدْرَتِكَ وَأَسْأَلُكَ مِنْ فَضْلِكَ الْعَظِيمِ فَإِنَّكَ تَقْدِرُ وَلَا أَقْدِرُ، وَتَعْلَمُ وَلَا أَعْلَمُ، وَأَنْتَ عَلَّامُ الْغُيُوبِ. اللَّهُمَّ إِنْ كُنْتَ تَعْلَمُ أَنَّ هَذَا الْأَمْرَ خَيْرٌ لِي فِي دِينِي وَمَعَاشِي وَعَاقِبَةِ أَمْرِي فَاقْدُرْهُ لِي وَيَسِّرْهُ ثُمَّ بَارِكْ لِي فِيهِ، وَإِنْ كُنْتَ تَعْلَمُ أَنَّ هَذَا الْأَمْرَ شَرٌّ لِي فِي دِينِي وَمَعَاشِي وَعَاقِبَةِ أَمْرِي فَاصْرِفْهُ عَنِّي وَاصْرِفْنِي عَنْهُ وَاقْدُرْ لِي الْخَيْرَ حَيْثُ كَانَ ثُمَّ أَرْضِنِي بِهِ',
      repeatCount: 1,
      referenceAr: 'رواه البخاري ومسلم - دعاء الاستخارة الأصلي',
      benefitAr: 'صلاة ركعتين ثم يقرأ بعد السلام هذا الدعاء سبع مرات',
    },
    {
      id: 'fb-i-4',
      orderInCategory: 4,
      textAr: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالسَّلَامَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي',
      repeatCount: 7,
      referenceAr: 'رواه الترمذي وأبو داود',
    },
    {
      id: 'fb-i-5',
      orderInCategory: 5,
      textAr: 'سيد الاستغفار',
      repeatCount: 1,
      referenceAr: 'رواه البخاري - قبل اتخاذ القرار',
    },
  ],
  WUDU: [
    {
      id: 'fb-w-1',
      orderInCategory: 1,
      textAr: 'بِسْمِ اللَّهِ',
      repeatCount: 1,
      referenceAr: 'رواه أبو داود والترمذي',
      benefitAr: 'قبل البدء بالوضوء',
    },
    {
      id: 'fb-w-2',
      orderInCategory: 2,
      textAr: 'اللَّهُمَّ اجْعَلْنِي مِنَ التَّوَّابِينَ وَاجْعَلْنِي مِنَ الْمُتَطَهِّرِينَ',
      repeatCount: 1,
      referenceAr: 'رواه الترمذي',
      benefitAr: 'عند فراغ الوضوء',
    },
    {
      id: 'fb-w-3',
      orderInCategory: 3,
      textAr: 'أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
      repeatCount: 1,
      referenceAr: 'رواه مسلم',
      benefitAr: 'بعد الوضوء ففتحت له أبواب الجنة الثمانية يدخل من أيها يشاء',
    },
    {
      id: 'fb-w-4',
      orderInCategory: 4,
      textAr:
        'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَسْتَغْفِرُكَ وَأَتُوبُ إِلَيْكَ',
      repeatCount: 1,
      referenceAr: 'رواه الترمذي وأبو داود - حسن صحيح',
    },
    {
      id: 'fb-w-5',
      orderInCategory: 5,
      textAr: 'اللَّهُمَّ زَيِّنِّي بِزِينَةِ الْإِيمَانِ وَاجْعَلْنِي مِنَ الْمُهْتَدِينَ',
      repeatCount: 1,
      referenceAr: 'رواه الحاكم وصححه',
    },
    {
      id: 'fb-w-6',
      orderInCategory: 6,
      textAr:
        'اللَّهُمَّ اغْفِرْ لِي ذَنْبِي وَوَسِّعْ لِي فِي دَارِي وَبَارِكْ لِي فِي رِزْقِي',
      repeatCount: 3,
      referenceAr: 'رواه ابن ماجه وابن حبان - صحيح',
    },
  ],
  ISTIGHFAR: [
    {
      id: 'fb-is-1',
      orderInCategory: 1,
      textAr: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ',
      repeatCount: 100,
      referenceAr: 'رواه البخاري ومسلم',
    },
    {
      id: 'fb-is-2',
      orderInCategory: 2,
      textAr: 'أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيَّ الْقَيُّومَ وَأَتُوبُ إِلَيْهِ',
      repeatCount: 100,
      referenceAr: 'رواه الترمذي - حسن صحيح',
      benefitAr: 'سيد الاستغفار للذين أتوب إليه صحيح',
    },
    {
      id: 'fb-is-3',
      orderInCategory: 3,
      textAr:
        'سَيِّدُ الِاسْتِغْفَارِ كامل: اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
      repeatCount: 10,
      referenceAr: 'رواه البخاري وأبو داود',
      benefitAr: 'من قالها متيقناً منها حين يمسي أو يصبح دخل الجنة',
    },
    {
      id: 'fb-is-4',
      orderInCategory: 4,
      textAr: 'اللَّهُمَّ اغْفِرْ لِي ذَنْبِي كُلَّهُ دِقَّهُ وَجِلَّهُ، وَأَوَّلَهُ وَآخِرَهُ، وَعَلَانِيَتَهُ وَسِرَّهُ',
      repeatCount: 10,
      referenceAr: 'رواه مسلم',
    },
    {
      id: 'fb-is-5',
      orderInCategory: 5,
      textAr: 'رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ إِنَّكَ أَنْتَ التَّوَّابُ الرَّحِيمُ',
      repeatCount: 40,
      referenceAr: 'رواه الترمذي',
    },
    {
      id: 'fb-is-6',
      orderInCategory: 6,
      textAr:
        'اللَّهُمَّ إِنِّي ظَلَمْتُ نَفْسِي ظُلْمًا كَثِيرًا وَلَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ فَاغْفِرْ لِي مَغْفِرَةً مِّنْ عِندِكَ وَارْحَمْنِي إِنَّكَ أَنْتَ الْغَفُورُ الرَّحِيمُ',
      repeatCount: 7,
      referenceAr: 'رواه البخاري ومسلم - دعاء سيدنا آدم',
    },
    {
      id: 'fb-is-7',
      orderInCategory: 7,
      textAr:
        'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ',
      repeatCount: 100,
      referenceAr: 'رواه الترمذي',
    },
  ],
  QAYN: [
    {
      id: 'fb-q-1',
      orderInCategory: 1,
      textAr: 'سُبْحَانَ اللَّهِ عَدَدَ مَا خَلَقَ وَبِحَمْدِهِ مِثْلَ ذَلِكَ',
      repeatCount: 1,
      referenceAr: 'رواه مسلم',
      benefitAr: 'ميزان حسنات ثقيل',
    },
    {
      id: 'fb-q-2',
      orderInCategory: 2,
      textAr: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ مِائَةَ مَرَّةً',
      repeatCount: 100,
      referenceAr: 'رواه البخاري ومسلم',
      benefitAr: 'تعدل مئة رقبة من عباد المؤمنين',
    },
    {
      id: 'fb-q-3',
      orderInCategory: 3,
      textAr: MUAWIDHAT,
      repeatCount: 3,
      referenceAr: 'المعوذات ثلاث',
    },
    {
      id: 'fb-q-4',
      orderInCategory: 4,
      textAr: IHLAS,
      repeatCount: 11,
      referenceAr: 'رواه الترمذي',
      benefitAr: 'حجارة من نار جهنم',
    },
    {
      id: 'fb-q-5',
      orderInCategory: 5,
      textAr: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ',
      repeatCount: 10,
      referenceAr: 'رواه مسلم',
    },
    {
      id: 'fb-q-6',
      orderInCategory: 6,
      textAr: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
      repeatCount: 10,
      referenceAr: 'رواه البخاري ومسلم',
    },
    {
      id: 'fb-q-7',
      orderInCategory: 7,
      textAr: 'رَبِّ اغْفِرْ وَارْحَمْ إِنَّكَ أَنْتَ الْأَعَلُّونَ',
      repeatCount: 10,
      referenceAr: 'رواه النسائي',
    },
  ],
  MASJID_AFTER_SALAM: [
    {
      id: 'fb-ms-1',
      orderInCategory: 1,
      textAr: 'أَسْتَغْفِرُ اللَّهَ (ثلاثاً)',
      repeatCount: 3,
      referenceAr: 'رواه مسلم',
      benefitAr: 'بعد التسليم الأخير من الصلاة مباشرة',
    },
    {
      id: 'fb-ms-2',
      orderInCategory: 2,
      textAr:
        'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ ذَا الْجَلَالِ وَالْإِكْرَامِ',
      repeatCount: 1,
      referenceAr: 'رواه مسلم',
    },
    {
      id: 'fb-ms-3',
      orderInCategory: 3,
      textAr: 'سُبْحَانَ اللَّهِ (33) ، الْحَمْدُ لِلَّهِ (33) ، اللَّهُ أَكْبَرُ (34)',
      repeatCount: 1,
      referenceAr: 'صحيح البخاري ومسلم',
    },
    {
      id: 'fb-ms-4',
      orderInCategory: 4,
      textAr: AYAT_AL_KURSI,
      repeatCount: 1,
      referenceAr: 'رواه مسلم',
    },
    {
      id: 'fb-ms-5',
      orderInCategory: 5,
      textAr:
        'اللَّهُمَّ اجْعَلْ قَلْبِي سَاكِنًا مِمَّا خَلَقْتَ وَمَا أَخْرَجْتَ، وَاخْتِمْ لِي بِسَعَادَةٍ فِي الدِّينِ وَالدُّنْيَا وَالآخِرَةِ',
      repeatCount: 1,
      referenceAr: 'رواه الحاكم وصححه',
    },
    {
      id: 'fb-ms-6',
      orderInCategory: 6,
      textAr: 'اللَّهُمَّ لَا تُدْخِلْنِي جَنَّةَ فِي رَوَدَّةٍ مِنْ شَأْنِي وَلَا وَجْهٍ مِنْ وُجُوهِ النَّاسِ، وَلَا مُشَارَكَةَ إِلَى شَيْءٍ حَرَامٍ',
      repeatCount: 7,
      referenceAr: 'رواه ابن ماجه وابن حبان - صحيح',
    },
  ],
} as const;

function buildCategoryFallback(key: CategoryKey): FallbackCategory {
  const base = ADHKAR_DHIKR_CATEGORIES_FALLBACK.find((c) => c.key === key);
  const items = FALLBACK_ITEMS[key] ?? [];
  return {
    id: `fb-cat-${key}`,
    key,
    nameAr: base?.nameAr ?? key,
    nameEn: base?.nameEn ?? key,
    descriptionAr: base?.descriptionAr ?? '',
    descriptionEn: base?.descriptionEn ?? '',
    iconCode: base?.iconCode ?? '📖',
    sortOrder: base?.sortOrder ?? 99,
    totalItems: items.length,
    items,
  };
}

const ALL_FALLBACK_CATEGORIES: FallbackCategory[] = CATEGORY_KEYS.map(buildCategoryFallback);

function getDayOfYearSafe(): number {
  try {
    return getDayOfYear();
  } catch {
    return Math.max(1, new Date().getDate());
  }
}

export async function getAllCategories() {
  try {
    const fromDb = await prisma.dhikrCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    if (fromDb && fromDb.length > 0) {
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
  } catch (err: any) {
    logger.warn('[Adhkar] getAllCategories prisma failed, returning hardcoded fallback categories', {
      code: err?.code,
      message: err?.message,
    });
  }

  return ALL_FALLBACK_CATEGORIES;
}

export async function getCategoryWithItems(key: string) {
  const normalizedKey = key.trim().toUpperCase();
  const match = CATEGORY_KEYS.find((k) => k === normalizedKey);

  try {
    const category = await prisma.dhikrCategory.findFirst({
      where: { key: (normalizedKey as any) },
      include: {
        items: {
          orderBy: { orderInCategory: 'asc' },
        },
      },
    });

    if (category) {
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
        markedItemId: null as string | null,
        items: category.items.map((it) => ({
          id: it.id,
          orderInCategory: it.orderInCategory,
          textAr: it.textAr,
          textEn: (it as any).textEn ?? '',
          textArPlain: ensureTextArPlain(it.textAr, it.textArPlain),
          repeatCount: it.repeatCount,
          referenceAr: it.referenceAr,
          referenceEn: it.referenceEn ?? '',
          sourceUrl: it.sourceUrl,
          benefitAr: it.benefitAr,
          benefitEn: (it as any).benefitEn ?? '',
        })),
      };
    }
  } catch (err: any) {
    logger.warn('[Adhkar] getCategoryWithItems prisma failed, returning fallback', {
      key: normalizedKey,
      code: err?.code,
      message: err?.message,
    });
  }

  if (match) {
    logger.warn('[Adhkar] DB had no DhikrCategory row for key in enum, returning hardcoded fallback', {
      key: normalizedKey,
    });
    return buildCategoryFallback(match);
  }

  throw new AppError(
    `Dhikr category not found for key: ${key}`,
    HttpStatus.NOT_FOUND,
    ErrorCodes.NOT_FOUND,
  );
}

export async function getDailyWird() {
  let wirdItems: FallbackItem[] = FALLBACK_ITEMS.GENERAL_WIRD;
  let wirdCategoryKey: CategoryKey = 'GENERAL_WIRD';

  try {
    const wirdCategory = await prisma.dhikrCategory.findFirst({
      where: { key: 'GENERAL_WIRD' },
      include: {
        items: {
          orderBy: { orderInCategory: 'asc' },
        },
      },
    });
    if (wirdCategory && wirdCategory.items.length > 0) {
      wirdItems = wirdCategory.items as unknown as FallbackItem[];
    }
  } catch (err: any) {
    logger.warn('[Adhkar] getDailyWird prisma failed, using fallback GENERAL_WIRD items', {
      code: err?.code,
      message: err?.message,
    });
  }

  const day = getDayOfYearSafe();
  const totalItems = wirdItems.length || 8;
  const goal = Math.min(8, totalItems);
  const progress = (((day * 37) % Math.max(1, goal)) + 1);

  const slice = wirdItems.slice(0, goal);

  return {
    titleAr: 'وردك اليوم',
    titleEn: 'Your Daily Wird',
    subtitleAr: 'واذكر ربك إذا نسيت',
    subtitleEn: 'And remember your Lord when you forget',
    progressItemsDone: progress,
    progressItemsTotal: goal,
    progressPercent: Math.round((progress / goal) * 100),
    ctaAr: 'اكمل وردك اليوم',
    ctaEn: 'Complete today\'s wird',
    categoryKey: wirdCategoryKey,
    items: slice.map((it, idx) => ({
      id: it.id,
      orderInCategory: it.orderInCategory ?? idx + 1,
      textAr: it.textAr,
      textEn: (it as any).textEn ?? '',
      textArPlain: ensureTextArPlain(it.textAr, (it as any).textArPlain),
      repeatCount: it.repeatCount,
      referenceAr: it.referenceAr,
      referenceEn: (it as any).referenceEn ?? '',
      benefitAr: it.benefitAr,
      benefitEn: (it as any).benefitEn ?? '',
    })),
  };
}

export async function getCategoriesWithDailyWird() {
  const [categories, dailyWird] = await Promise.all([
    getAllCategories(),
    getDailyWird(),
  ]);

  return {
    greeting: 'واذكر ربك إذا نسيت',
    greetingEn: 'And remember your Lord when you forget',
    // Contract §4 — also expose daily-wird titles/CTAs at the home root
    titleAr: dailyWird.titleAr,
    titleEn: dailyWird.titleEn,
    ctaAr: dailyWird.ctaAr,
    ctaEn: dailyWird.ctaEn,
    dailyWird,
    categories,
  };
}

// ============================================================
//  Adhkar Progress — resume mark + tap counts per user per day
// ============================================================

function getTodayDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export async function getAdhkarProgress(userId: string, categoryKey: string) {
  const key = categoryKey.toUpperCase() as CategoryKey;
  if (!CATEGORY_KEYS.includes(key as any)) {
    throw new AppError(
      `Invalid category key: ${categoryKey}`,
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const date = getTodayDate();

  // Find the category (DB or fallback)
  let category: { id: string; key: string; totalItems: number } | null = null;
  let items: { id: string; orderInCategory: number; textAr: string; repeatCount: number }[] = [];

  try {
    const dbCat = await prisma.dhikrCategory.findFirst({
      where: { key: key as any },
      include: {
        items: {
          orderBy: { orderInCategory: 'asc' },
          select: { id: true, orderInCategory: true, textAr: true, repeatCount: true },
        },
      },
    });
    if (dbCat) {
      category = { id: dbCat.id, key: dbCat.key, totalItems: dbCat.items.length };
      items = dbCat.items;
    }
  } catch {
    // fallback
  }

  // Use fallback if DB didn't return
  if (!category || items.length === 0) {
    const fallbackItems = FALLBACK_ITEMS[key] ?? [];
    items = fallbackItems.map((fi, idx) => ({
      id: fi.id,
      orderInCategory: fi.orderInCategory ?? idx + 1,
      textAr: fi.textAr,
      repeatCount: fi.repeatCount,
    }));
  }

  // Get user's completions for today + this category.
  // Wrapped in try/catch: if the table doesn't exist yet (pending migration) we
  // gracefully return all-zero progress rather than a 500.
  let completions: Array<{ itemId: string | null; countDone: number }> = [];
  try {
    completions = await prisma.dailyDhikrCompletion.findMany({
      where: {
        userId,
        date,
        ...(category?.id ? { categoryId: category.id } : {}),
      },
      select: { itemId: true, countDone: true },
    });
  } catch {
    // Table may not exist on this environment yet — fall through with empty completions.
  }

  const completionMap = new Map(completions.map((c) => [c.itemId, c.countDone]));

  const itemProgress = items.map((item) => {
    const tapCount = completionMap.get(item.id) ?? 0;
    return {
      itemId: item.id,
      tapCount,
      completed: tapCount >= item.repeatCount,
    };
  });

  const progressItemsDone = itemProgress.filter((ip) => ip.completed).length;
  const progressItemsTotal = items.length;

  // Find the first non-completed item as resume mark
  const firstIncomplete = itemProgress.find((ip) => !ip.completed);
  const markedItemId = firstIncomplete?.itemId ?? (items[items.length - 1]?.id ?? null);

  return {
    categoryKey: key,
    markedItemId,
    items: itemProgress,
    progressItemsDone,
    progressItemsTotal,
    progressPercent: progressItemsTotal > 0
      ? Math.round((progressItemsDone / progressItemsTotal) * 100)
      : 0,
  };
}

export async function saveAdhkarProgress(
  userId: string,
  categoryKey: string,
  itemId: string,
  tapCount: number,
) {
  const key = categoryKey.toUpperCase() as CategoryKey;
  if (!CATEGORY_KEYS.includes(key as any)) {
    throw new AppError(
      `Invalid category key: ${categoryKey}`,
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  if (tapCount < 0) {
    throw new AppError(
      'tapCount must be zero or greater',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const date = getTodayDate();

  // Resolve categoryId
  let categoryId: string | null = null;
  try {
    const dbCat = await prisma.dhikrCategory.findFirst({
      where: { key: key as any },
      select: { id: true },
    });
    categoryId = dbCat?.id ?? null;
  } catch {
    // fallback categories have no DB id
  }

  // Upsert the completion — wrapped in try/catch so a missing table degrades
  // gracefully instead of returning 500 to Flutter.
  try {
    await prisma.dailyDhikrCompletion.upsert({
      where: {
        userId_date_categoryId_itemId: {
          userId,
          date,
          categoryId: categoryId ?? '',
          itemId,
        },
      },
      create: {
        userId,
        date,
        categoryId,
        itemId,
        countDone: tapCount,
      },
      update: {
        countDone: tapCount,
      },
    });
  } catch {
    // Table doesn't exist yet — progress will be returned from in-memory fallback.
  }

  // Return full progress
  return getAdhkarProgress(userId, key);
}


// ============================================================
// Adhkar Favorites (حفظ الأذكار المفضلة)
// ============================================================

/**
 * List user's favorite adhkar
 */
export async function listAdhkarFavorites(userId: string) {
  const favorites: any = await prisma.adhkarFavorite.findMany({
    where: { userId },
    include: {
      item: {
        include: {
          category: {
            select: {
              id: true,
              key: true,
              nameAr: true,
              nameEn: true,
              iconCode: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return favorites.map((fav: any) => ({
    id: fav.id,
    itemId: fav.itemId,
    dhikr: {
      id: fav.item.id,
      textAr: fav.item.textAr,
      textEn: '',
      textArPlain: ensureTextArPlain(fav.item.textAr, fav.item.textArPlain),
      repeatCount: fav.item.repeatCount,
      referenceAr: fav.item.referenceAr,
      referenceEn: fav.item.referenceEn ?? '',
      benefitAr: fav.item.benefitAr,
      benefitEn: '',
      category: fav.item.category,
    },
    createdAt: fav.createdAt.toISOString(),
  }));
}

/**
 * Add adhkar to favorites
 */
export async function addAdhkarFavorite(userId: string, itemId: string) {
  // Check if item exists
  const item = await prisma.dhikrItem.findUnique({
    where: { id: itemId },
  });

  if (!item) {
    throw new AppError('Dhikr item not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  // Check if already favorited
  const existing = await prisma.adhkarFavorite.findUnique({
    where: {
      userId_itemId: {
        userId,
        itemId,
      },
    },
  });

  if (existing) {
    throw new AppError('This dhikr is already in your favorites', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
  }

  // Create favorite
  const favorite: any = await prisma.adhkarFavorite.create({
    data: {
      userId,
      itemId,
    },
    include: {
      item: {
        include: {
          category: {
            select: {
              id: true,
              key: true,
              nameAr: true,
              nameEn: true,
              iconCode: true,
            },
          },
        },
      },
    },
  });

  const fav: any = favorite;

  return {
    id: fav.id,
    itemId: fav.itemId,
    dhikr: {
      id: fav.item.id,
      textAr: fav.item.textAr,
      textEn: '',
      textArPlain: ensureTextArPlain(fav.item.textAr, fav.item.textArPlain),
      repeatCount: fav.item.repeatCount,
      referenceAr: fav.item.referenceAr,
      referenceEn: fav.item.referenceEn ?? '',
      benefitAr: fav.item.benefitAr,
      benefitEn: '',
      category: fav.item.category,
    },
    createdAt: fav.createdAt.toISOString(),
  };
}

/**
 * Remove adhkar from favorites
 */
export async function removeAdhkarFavorite(userId: string, favoriteId: string) {
  // Check ownership
  const favorite = await prisma.adhkarFavorite.findUnique({
    where: { id: favoriteId },
  });

  if (!favorite || favorite.userId !== userId) {
    throw new AppError('Favorite not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  await prisma.adhkarFavorite.delete({
    where: { id: favoriteId },
  });

  return { message: 'Favorite removed successfully' };
}

/**
 * Check if adhkar is favorited
 */
export async function isAdhkarFavorited(userId: string, itemId: string): Promise<boolean> {
  const favorite = await prisma.adhkarFavorite.findUnique({
    where: {
      userId_itemId: {
        userId,
        itemId,
      },
    },
  });

  return !!favorite;
}

// ============================================================
// Search adhkar across all categories (DB + fallback)
// ============================================================

function stripTashkeel(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureTextArPlain(textAr: string, textArPlain?: string | null): string {
  const plain = (textArPlain ?? '').toString().trim();
  if (plain.length > 0) return plain;
  return stripTashkeel(textAr ?? '');
}

type SearchResultItem = {
  id: string;
  categoryKey: string;
  categoryNameAr: string;
  categoryNameEn: string;
  orderInCategory: number;
  textAr: string;
  textEn: string;
  textArPlain?: string;
  repeatCount: number;
  referenceAr?: string;
  referenceEn?: string;
  benefitAr?: string;
  benefitEn?: string;
  sourceUrl?: string;
  matchScore: number;
};

/**
 * Search across all DhikrItem (DB) + fallback items in all categories.
 * Matches are scored on: textAr (plain/tashkeel-insensitive), referenceAr, benefitAr.
 */
export async function searchAdhkar(
  qRaw: string,
  options: { limit?: number; categoryKey?: string } = {},
): Promise<{
  query: string;
  total: number;
  limit: number;
  items: SearchResultItem[];
}> {
  const queryRaw = (qRaw ?? '').trim();
  const limit = Math.max(1, Math.min(100, options.limit ?? 50));

  if (queryRaw.length === 0) {
    return { query: queryRaw, total: 0, limit, items: [] };
  }

  const queryStripped = stripTashkeel(queryRaw).toLowerCase();
  const queryTokens = queryStripped
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1);

  const categoryFilterKey = options.categoryKey
    ? String(options.categoryKey).toUpperCase()
    : null;

  // 1) Aggregate a pool of items: DB rows first, fallback for any category
  const pool: Array<Omit<SearchResultItem, 'matchScore'>> = [];

  // 1a) DB DhikrItem rows (join category)
  try {
    const dbItems = await prisma.dhikrItem.findMany({
      where: categoryFilterKey
        ? {
          category: { key: categoryFilterKey as any },
        }
        : undefined,
      include: {
        category: {
          select: { key: true, nameAr: true, nameEn: true },
        },
      },
      take: 2000,
    });

    for (const it of dbItems) {
      if (!it.category) continue;
      pool.push({
        id: it.id,
        categoryKey: String(it.category.key),
        categoryNameAr: it.category.nameAr,
        categoryNameEn: it.category.nameEn,
        orderInCategory: it.orderInCategory,
        textAr: it.textAr,
        textEn: '',
        textArPlain: ensureTextArPlain(it.textAr, it.textArPlain),
        repeatCount: it.repeatCount,
        referenceAr: it.referenceAr ?? undefined,
        referenceEn: it.referenceEn ?? '',
        benefitAr: it.benefitAr ?? undefined,
        benefitEn: '',
        sourceUrl: it.sourceUrl ?? undefined,
      });
    }
  } catch (err: any) {
    logger.warn('[Adhkar] searchAdhkar DB query failed, relying on hardcoded fallbacks only', {
      code: err?.code,
      message: err?.message,
    });
  }

  // 1b) Add fallback items only for categories where the DB returned zero rows,
  //     OR when no categoryFilter and pool is still small.
  const fallbackKeysToInclude: CategoryKey[] = [];
  for (const key of CATEGORY_KEYS) {
    if (categoryFilterKey && key !== categoryFilterKey) continue;
    const hasDbRowsForCategory = pool.some(
      (p) => String(p.categoryKey).toUpperCase() === key,
    );
    if (!hasDbRowsForCategory) fallbackKeysToInclude.push(key);
  }

  for (const key of fallbackKeysToInclude) {
    const fallback = buildCategoryFallback(key);
    for (const it of fallback.items) {
      pool.push({
        id: it.id,
        categoryKey: fallback.key,
        categoryNameAr: fallback.nameAr,
        categoryNameEn: fallback.nameEn,
        orderInCategory: it.orderInCategory,
        textAr: it.textAr,
        textEn: '',
        textArPlain: ensureTextArPlain(it.textAr, undefined),
        repeatCount: it.repeatCount,
        referenceAr: it.referenceAr,
        referenceEn: '',
        benefitAr: it.benefitAr,
        benefitEn: '',
      });
    }
  }

  // 2) Score and filter
  const scored: SearchResultItem[] = [];
  for (const item of pool) {
    const haystack = stripTashkeel(
      [
        item.textAr,
        item.textArPlain ?? '',
        item.referenceAr ?? '',
        item.referenceEn ?? '',
        item.benefitAr ?? '',
        item.benefitEn ?? '',
        item.categoryNameAr,
        item.categoryNameEn,
      ]
        .filter(Boolean)
        .join(' \n '),
    ).toLowerCase();

    if (!haystack) continue;

    // Exact substring on stripped haystack -> highest score
    let score = 0;
    if (queryStripped.length >= 2 && haystack.includes(queryStripped)) {
      score += 100;
    }

    // Token matches
    let tokenHits = 0;
    for (const tok of queryTokens) {
      if (haystack.includes(tok)) {
        tokenHits += 1;
        score += 10 * tok.length;
      }
    }

    // Bonus if it's a match on textAr specifically (the main field)
    const textStripped = stripTashkeel(item.textAr + ' ' + (item.textArPlain ?? ''))
      .toLowerCase();
    if (queryStripped.length >= 2 && textStripped.includes(queryStripped)) {
      score += 50;
    }
    for (const tok of queryTokens) {
      if (tok.length >= 2 && textStripped.includes(tok)) {
        score += 15;
      }
    }

    if (score > 0 || tokenHits >= 1) {
      scored.push({ ...item, matchScore: score });
    }
  }

  // 3) Sort desc by score, then apply limit
  scored.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (a.categoryKey !== b.categoryKey) return a.categoryKey.localeCompare(b.categoryKey);
    return a.orderInCategory - b.orderInCategory;
  });

  const items = scored.slice(0, limit);

  return {
    query: queryRaw,
    total: scored.length,
    limit,
    items,
  };
}


// ============================================================
//  Adhkar Resume Mark — persist bookmark position per user
// ============================================================

export async function getCategoryWithItemsForUser(key: string, userId: string) {
  const category = await getCategoryWithItems(key);

  // Get user's resume mark for this category
  try {
    const resumeMark = await prisma.adhkarResumeMark.findUnique({
      where: {
        userId_categoryKey: {
          userId,
          categoryKey: key.trim().toUpperCase(),
        },
      },
      select: { markedItemId: true },
    });

    if (resumeMark) {
      return {
        ...category,
        markedItemId: resumeMark.markedItemId,
      };
    }
  } catch (err: any) {
    logger.warn('[Adhkar] Failed to fetch resume mark, returning category without mark', {
      userId,
      categoryKey: key,
      code: err?.code,
    });
  }

  return category;
}

export async function saveResumeMark(
  userId: string,
  categoryKey: string,
  markedItemId: string,
): Promise<{ markedItemId: string }> {
  const normalizedKey = categoryKey.trim().toUpperCase();

  try {
    const mark = await prisma.adhkarResumeMark.upsert({
      where: {
        userId_categoryKey: {
          userId,
          categoryKey: normalizedKey,
        },
      },
      create: {
        userId,
        categoryKey: normalizedKey,
        markedItemId,
      },
      update: {
        markedItemId,
      },
      select: { markedItemId: true },
    });

    return { markedItemId: mark.markedItemId };
  } catch (err: any) {
    logger.error('[Adhkar] Failed to save resume mark', {
      userId,
      categoryKey: normalizedKey,
      markedItemId,
      code: err?.code,
      message: err?.message,
    });
    throw new AppError(
      'Failed to save resume mark',
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorCodes.DATABASE_ERROR,
    );
  }
}

// ============================================================
//  Real Daily Wird Progress (for signed-in users)
// ============================================================

export async function getDailyWirdForUser(userId: string) {
  const baseWird = await getDailyWird();

  // Calculate real progress from user's completions
  const date = getTodayDate();

  try {
    const wirdCategory = await prisma.dhikrCategory.findFirst({
      where: { key: 'GENERAL_WIRD' },
      include: {
        items: {
          orderBy: { orderInCategory: 'asc' },
          take: 8, // Daily wird goal is 8 items
        },
      },
    });

    if (!wirdCategory || wirdCategory.items.length === 0) {
      return baseWird; // Fallback to cosmetic progress
    }

    const itemIds = wirdCategory.items.map((it) => it.id);

    const completions = await prisma.dailyDhikrCompletion.findMany({
      where: {
        userId,
        date,
        categoryId: wirdCategory.id,
        itemId: { in: itemIds },
      },
      select: { itemId: true, countDone: true },
    });

    const completionMap = new Map(
      completions.map((c) => [c.itemId, c.countDone]),
    );

    // Count how many items are done (countDone >= repeatCount)
    let itemsDone = 0;
    for (const item of wirdCategory.items) {
      const done = completionMap.get(item.id) ?? 0;
      if (done >= item.repeatCount) {
        itemsDone += 1;
      }
    }

    const total = wirdCategory.items.length;
    const percent = total > 0 ? Math.round((itemsDone / total) * 100) : 0;

    return {
      ...baseWird,
      progressItemsDone: itemsDone,
      progressItemsTotal: total,
      progressPercent: percent,
    };
  } catch (err: any) {
    logger.warn('[Adhkar] Failed to calculate real wird progress, using cosmetic', {
      userId,
      code: err?.code,
      message: err?.message,
    });
    return baseWird;
  }
}

/**
 * One-time adhkar content corrections (2026-09-28), applied to the legacy 115-item catalog.
 * Findings and reasoning: docs/ADHKAR_CONTENT_REVIEW_2026.md
 *
 * Rules target legacy rows by (category, legacy orderInCategory, text prefix). The prefix check is a
 * guard: a rule never touches a row whose text does not match, so a second run cannot double-apply.
 */
import { normalizeArabicForSearch } from '../../src/shared/utils/arabic-normalize';

export type AdhkarCategoryKey =
  | 'MORNING'
  | 'EVENING'
  | 'BEFORE_SLEEP'
  | 'ENTERING_MOSQUE'
  | 'AFTER_PRAYER'
  | 'GENERAL_WIRD'
  | 'TRAVEL'
  | 'SICK'
  | 'FOOD'
  | 'ISTIKHARA'
  | 'WUDU'
  | 'ISTIGHFAR'
  | 'QAYN'
  | 'MASJID_AFTER_SALAM';

export type AdhkarPatch = {
  textAr?: string;
  repeatCount?: number;
  referenceAr?: string | null;
  benefitAr?: string | null;
};

export type AdhkarCorrection = {
  category: AdhkarCategoryKey;
  order: number;
  startsWith: string;
} & ({ remove: true; patch?: never } | { remove?: never; patch: AdhkarPatch });

const JIN_REF = '(رواه النسائي في الكبرى والحاكم)';
const HITTAT = 'من قالها مائة مرة حُطَّت خطاياه وإن كانت مثل زبد البحر (رواه البخاري ومسلم)';
const FIRAR = 'من قالها غُفر له وإن كان فرَّ من الزحف';
const KURSI_AFTER_PRAYER = 'من قرأها دبر كل صلاة مكتوبة لم يمنعه من دخول الجنة إلا أن يموت';
const SALAT_NASAI_REF = 'فضل الصلاة على النبي ﷺ رواه النسائي';
const SALAT_NASAI_BEN =
  'من صلى على النبي ﷺ صلاة واحدة صلى الله عليه عشر صلوات، وحُطَّت عنه عشر خطيئات، ورُفعت له عشر درجات';
const ASHHADUKA_REF = 'رواه أبو داود - أربع مرات';
const ASHHADUKA_BEN = 'من قالها أربع مرات أعتقه الله من النار';
const HAYY_QAYYUM_REF = 'رواه النسائي في الكبرى والحاكم';
const GENERAL_DUA_BELIEVERS_REF = 'دعاء عام، أصله قوله تعالى: ﴿وَاسْتَغْفِرْ لِذَنبِكَ وَلِلْمُؤْمِنِينَ وَالْمُؤْمِنَاتِ﴾ (سورة محمد 19)';

export const ADHKAR_CORRECTIONS_2026: readonly AdhkarCorrection[] = [
  // MORNING
  { category: 'MORNING', order: 1, startsWith: 'أعوذ بالله من الشيطان الرجيم. الله لا إله إلا هو', patch: { benefitAr: `من قالها حين يصبح أُجير من الجن حتى يمسي، ومن قالها حين يمسي أُجير منهم حتى يصبح ${JIN_REF}` } },
  { category: 'MORNING', order: 2, startsWith: 'قل هو الله أحد', patch: { benefitAr: 'من قرأهن حين يمسي وحين يصبح ثلاث مرات كفتاه من كل شيء (رواه أبو داود والترمذي)' } },
  { category: 'MORNING', order: 5, startsWith: 'اللهم إني أصبحت أشهدك', patch: { referenceAr: ASHHADUKA_REF, benefitAr: ASHHADUKA_BEN } },
  { category: 'MORNING', order: 6, startsWith: 'اللهم ما أصبح بي من نعمة', patch: { referenceAr: 'رواه أبو داود' } },
  { category: 'MORNING', order: 8, startsWith: 'لا إله إلا الله وحده لا شريك له', patch: { benefitAr: 'من قالها عشر مرات كان كمن أعتق أربعة أنفس من ولد إسماعيل (رواه البخاري ومسلم)' } },
  { category: 'MORNING', order: 9, startsWith: 'أستغفر الله العظيم الذي لا إله إلا هو', patch: { referenceAr: 'رواه أبو داود والترمذي', benefitAr: FIRAR } },
  { category: 'MORNING', order: 11, startsWith: 'اللهم صل على محمد عبدك ورسولك', patch: { referenceAr: 'فضل الصلاة على النبي ﷺ رواه مسلم' } },
  { category: 'MORNING', order: 12, startsWith: 'يا حي يا قيوم برحمتك أستغيث', patch: { referenceAr: HAYY_QAYYUM_REF } },

  // EVENING
  { category: 'EVENING', order: 1, startsWith: 'أعوذ بالله من الشيطان الرجيم. الله لا إله إلا هو', patch: { benefitAr: `من قالها حين يمسي أُجير من الجن حتى يصبح ${JIN_REF}` } },
  { category: 'EVENING', order: 5, startsWith: 'اللهم إني أمسيت أشهدك', patch: { referenceAr: ASHHADUKA_REF, benefitAr: ASHHADUKA_BEN } },
  { category: 'EVENING', order: 6, startsWith: 'اللهم ما أمسى بي من نعمة', patch: { referenceAr: 'رواه أبو داود' } },
  { category: 'EVENING', order: 7, startsWith: 'سبحان الله وبحمده', patch: { benefitAr: HITTAT } },
  { category: 'EVENING', order: 9, startsWith: 'أستغفر الله العظيم الذي لا إله إلا هو', patch: { referenceAr: 'رواه أبو داود والترمذي', benefitAr: FIRAR } },
  { category: 'EVENING', order: 11, startsWith: 'اللهم صل على محمد عبدك ورسولك', patch: { referenceAr: 'فضل الصلاة على النبي ﷺ رواه مسلم' } },

  // BEFORE_SLEEP
  { category: 'BEFORE_SLEEP', order: 4, startsWith: 'اللهم قني عذابك', patch: { benefitAr: null } },
  {
    category: 'BEFORE_SLEEP', order: 5, startsWith: 'اللهم إنك خلقت نفسي',
    patch: {
      textAr: 'اللَّهُمَّ خَلَقْتَ نَفْسِي وَأَنْتَ تَوَفَّاهَا، لَكَ مَمَاتُهَا وَمَحْيَاهَا، إِنْ أَحْيَيْتَهَا فَاحْفَظْهَا، وَإِنْ أَمَتَّهَا فَاغْفِرْ لَهَا، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ',
      referenceAr: 'رواه مسلم',
    },
  },
  {
    category: 'BEFORE_SLEEP', order: 6, startsWith: 'سبحان الله - ثلاثا وثلاثين',
    patch: {
      textAr: 'سُبْحَانَ اللَّهِ (ثَلَاثًا وَثَلَاثِينَ)، وَالْحَمْدُ لِلَّهِ (ثَلَاثًا وَثَلَاثِينَ)، وَاللَّهُ أَكْبَرُ (أَرْبَعًا وَثَلَاثِينَ)',
      referenceAr: 'رواه البخاري ومسلم',
      benefitAr: 'علّمها النبي ﷺ عليًّا وفاطمة رضي الله عنهما عند النوم وقال: «فهو خير لكما من خادم»',
    },
  },
  { category: 'BEFORE_SLEEP', order: 7, startsWith: 'أعوذ بالله السميع العليم', remove: true },
  { category: 'BEFORE_SLEEP', order: 8, startsWith: 'اللهم اجعل داخل ليلتي', remove: true },
  {
    category: 'BEFORE_SLEEP', order: 9, startsWith: 'اللهم اسلمني لك',
    patch: {
      textAr: 'اللَّهُمَّ أَسْلَمْتُ نَفْسِي إِلَيْكَ، وَوَجَّهْتُ وَجْهِي إِلَيْكَ، وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَأَلْجَأْتُ ظَهْرِي إِلَيْكَ، رَغْبَةً وَرَهْبَةً إِلَيْكَ، لَا مَلْجَأَ وَلَا مَنْجَا مِنْكَ إِلَّا إِلَيْكَ، آمَنْتُ بِكِتَابِكَ الَّذِي أَنْزَلْتَ، وَبِنَبِيِّكَ الَّذِي أَرْسَلْتَ',
      referenceAr: 'رواه البخاري ومسلم',
      benefitAr: 'فإن مُتَّ من ليلتك فأنت على الفطرة',
    },
  },

  // ENTERING_MOSQUE
  { category: 'ENTERING_MOSQUE', order: 2, startsWith: 'بسم الله والسلام على رسول الله', patch: { referenceAr: 'رواه ابن ماجه والترمذي' } },
  {
    category: 'ENTERING_MOSQUE', order: 3, startsWith: 'أعوذ بالله العظيم وبوجهه الكريم',
    patch: {
      textAr: 'أَعُوذُ بِاللَّهِ الْعَظِيمِ، وَبِوَجْهِهِ الْكَرِيمِ، وَسُلْطَانِهِ الْقَدِيمِ، مِنَ الشَّيْطَانِ الرَّجِيمِ',
      repeatCount: 1,
      referenceAr: 'رواه أبو داود - عند دخول المسجد',
      benefitAr: 'إذا قال ذلك قال الشيطان: حُفِظ مني سائر اليوم',
    },
  },
  { category: 'ENTERING_MOSQUE', order: 5, startsWith: 'سبحان الله وبحمده', patch: { benefitAr: HITTAT } },
  { category: 'ENTERING_MOSQUE', order: 8, startsWith: 'ركعتا التحية', remove: true },
  { category: 'ENTERING_MOSQUE', order: 10, startsWith: 'سبحان الله (33)', patch: { referenceAr: 'رواه مسلم' } },

  // AFTER_PRAYER
  { category: 'AFTER_PRAYER', order: 3, startsWith: 'أعوذ بالله من الشيطان الرجيم. الله لا إله إلا هو', patch: { referenceAr: 'رواه النسائي في الكبرى - بعد كل صلاة مكتوبة', benefitAr: KURSI_AFTER_PRAYER } },
  { category: 'AFTER_PRAYER', order: 4, startsWith: 'قل هو الله أحد', patch: { referenceAr: 'رواه أبو داود والترمذي والنسائي - بعد كل صلاة' } },
  { category: 'AFTER_PRAYER', order: 5, startsWith: 'لا إله إلا الله وحده لا شريك له', remove: true },
  { category: 'AFTER_PRAYER', order: 6, startsWith: 'اللهم أنت ربي لا إله إلا أنت', patch: { referenceAr: 'سيد الاستغفار - رواه البخاري', benefitAr: 'من قالها من النهار موقنًا بها فمات من يومه قبل أن يمسي فهو من أهل الجنة' } },
  { category: 'AFTER_PRAYER', order: 7, startsWith: 'سبحان الله (33)', patch: { referenceAr: 'رواه مسلم - بعد كل صلاة' } },
  { category: 'AFTER_PRAYER', order: 8, startsWith: 'اللهم صل وسلم وبارك على نبينا محمد', patch: { referenceAr: SALAT_NASAI_REF, benefitAr: SALAT_NASAI_BEN } },
  { category: 'AFTER_PRAYER', order: 9, startsWith: 'اللهم اغفر للمؤمنين والمؤمنات', patch: { referenceAr: GENERAL_DUA_BELIEVERS_REF } },

  // GENERAL_WIRD
  { category: 'GENERAL_WIRD', order: 1, startsWith: 'لا حول ولا قوة إلا بالله', patch: { benefitAr: 'كنز من كنوز الجنة (رواه البخاري ومسلم)' } },
  { category: 'GENERAL_WIRD', order: 3, startsWith: 'أستغفر الله وأتوب إليه', patch: { benefitAr: 'كان النبي ﷺ يتوب إلى الله في اليوم مائة مرة (رواه مسلم)' } },
  { category: 'GENERAL_WIRD', order: 4, startsWith: 'اللهم صل على محمد عبدك ورسولك', patch: { referenceAr: SALAT_NASAI_REF, benefitAr: SALAT_NASAI_BEN } },
  { category: 'GENERAL_WIRD', order: 5, startsWith: 'يا حي يا قيوم برحمتك أستغيث', patch: { referenceAr: HAYY_QAYYUM_REF } },
  { category: 'GENERAL_WIRD', order: 6, startsWith: 'اللهم اكتب علي الهدى', patch: { textAr: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى', referenceAr: 'رواه مسلم' } },
  { category: 'GENERAL_WIRD', order: 8, startsWith: 'اللهم اجعل قلبي مؤمنا', remove: true },
  { category: 'GENERAL_WIRD', order: 9, startsWith: 'اللهم إني أسألك العفو والعافية', patch: { textAr: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي', referenceAr: 'رواه أبو داود وابن ماجه' } },
  { category: 'GENERAL_WIRD', order: 10, startsWith: 'سورة ياسين', remove: true },

  // TRAVEL
  { category: 'TRAVEL', order: 1, startsWith: 'سبحان الذي سخر لنا هذا', patch: { referenceAr: 'سورة الزخرف: 13-14 - دعاء السفر رواه مسلم' } },
  {
    category: 'TRAVEL', order: 2, startsWith: 'اللهم أنت الصاحب في السفر',
    patch: {
      textAr: 'اللَّهُمَّ أَنْتَ الصَّاحِبُ فِي السَّفَرِ، وَالْخَلِيفَةُ فِي الْأَهْلِ، اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ وَعْثَاءِ السَّفَرِ، وَكَآبَةِ الْمَنْظَرِ، وَسُوءِ الْمُنْقَلَبِ فِي الْمَالِ وَالْأَهْلِ',
      referenceAr: 'رواه مسلم',
    },
  },
  { category: 'TRAVEL', order: 3, startsWith: 'سبحان الله وبحمده', remove: true },
  { category: 'TRAVEL', order: 4, startsWith: 'حسبي الله وكفى', remove: true },
  { category: 'TRAVEL', order: 6, startsWith: 'رب أنزلني منزلا مباركا', patch: { referenceAr: 'سورة المؤمنون: 29' } },
  { category: 'TRAVEL', order: 7, startsWith: 'قل هو الله أحد', patch: { referenceAr: 'المعوذات الثلاث' } },

  // SICK
  { category: 'SICK', order: 1, startsWith: 'اللهم رب الناس', patch: { benefitAr: null } },
  { category: 'SICK', order: 2, startsWith: 'أعوذ بالله وقدرته', patch: { benefitAr: 'ضع يدك على موضع الألم وقل: بسم الله (ثلاثًا)، ثم قلها سبع مرات' } },
  { category: 'SICK', order: 3, startsWith: 'أعوذ بالله من الشيطان الرجيم. الله لا إله إلا هو', patch: { referenceAr: 'آية الكرسي - سورة البقرة 255', benefitAr: null } },
  { category: 'SICK', order: 4, startsWith: 'اللهم لا تؤاخذنا بعذابك', remove: true },
  { category: 'SICK', order: 6, startsWith: 'يا حي يا قيوم برحمتك أستغيث', patch: { referenceAr: HAYY_QAYYUM_REF } },
  {
    category: 'SICK', order: 7, startsWith: 'رب اشفه',
    patch: {
      textAr: 'أَسْأَلُ اللَّهَ الْعَظِيمَ، رَبَّ الْعَرْشِ الْعَظِيمِ، أَنْ يَشْفِيَكَ',
      repeatCount: 7,
      referenceAr: 'رواه أبو داود والترمذي - عند عيادة المريض',
      benefitAr: 'ما من مسلم يعود مريضًا لم يحضر أجله فيقولها سبع مرات إلا عافاه الله من ذلك المرض',
    },
  },
  { category: 'SICK', order: 8, startsWith: 'اللهم إني أسألك العافية', patch: { textAr: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ', referenceAr: 'رواه أبو داود وابن ماجه' } },

  // FOOD
  { category: 'FOOD', order: 1, startsWith: 'بسم الله وعلى بركة الله', patch: { textAr: 'بِسْمِ اللَّهِ', referenceAr: 'رواه أبو داود والترمذي', benefitAr: 'قبل الأكل، فإن نسي في أوله فليقل: بسم الله أوله وآخره' } },
  { category: 'FOOD', order: 2, startsWith: 'اللهم بارك لنا فيما رزقتنا', patch: { textAr: 'اللَّهُمَّ بَارِكْ لَنَا فِيهِ، وَأَطْعِمْنَا خَيْرًا مِنْهُ', referenceAr: 'رواه الترمذي', benefitAr: null } },
  { category: 'FOOD', order: 4, startsWith: 'إن شاء الله بارك فيه', remove: true },
  { category: 'FOOD', order: 5, startsWith: 'اللهم أحللت لنا حلالك', remove: true },
  { category: 'FOOD', order: 6, startsWith: 'غفر الله لك ما سلف', remove: true },
  { category: 'FOOD', order: 7, startsWith: 'رب اغفر لي وارحمني وبارك لي', remove: true },

  // ISTIKHARA
  { category: 'ISTIKHARA', order: 1, startsWith: 'أعوذ بالله من الشيطان الرجيم. الله لا إله إلا هو', remove: true },
  { category: 'ISTIKHARA', order: 2, startsWith: 'قل هو الله أحد', remove: true },
  { category: 'ISTIKHARA', order: 3, startsWith: 'اللهم إني أستخيرك بعلمك', patch: { referenceAr: 'رواه البخاري - دعاء الاستخارة', benefitAr: 'يصلي ركعتين من غير الفريضة ثم يدعو بهذا الدعاء ويسمّي حاجته' } },
  { category: 'ISTIKHARA', order: 4, startsWith: 'اللهم إني أسألك الهدى والسلامة', remove: true },
  { category: 'ISTIKHARA', order: 5, startsWith: 'اللهم أنت ربي لا إله إلا أنت', remove: true },

  // WUDU
  { category: 'WUDU', order: 3, startsWith: 'أشهد أن لا إله إلا الله', patch: { textAr: 'أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ' } },
  { category: 'WUDU', order: 4, startsWith: 'سبحانك اللهم وبحمدك', patch: { referenceAr: 'رواه النسائي في الكبرى' } },
  { category: 'WUDU', order: 5, startsWith: 'اللهم زيني بزينة الإيمان', remove: true },
  { category: 'WUDU', order: 6, startsWith: 'اللهم اغفر لي ذنبي ووسع لي في داري', patch: { referenceAr: 'رواه الترمذي والنسائي' } },

  // ISTIGHFAR
  { category: 'ISTIGHFAR', order: 2, startsWith: 'أستغفر الله العظيم الذي لا إله إلا هو', patch: { referenceAr: 'رواه أبو داود والترمذي', benefitAr: FIRAR } },
  { category: 'ISTIGHFAR', order: 3, startsWith: 'اللهم أنت ربي لا إله إلا أنت', patch: { repeatCount: 1 } },
  { category: 'ISTIGHFAR', order: 5, startsWith: 'رب اغفر لي وتب علي', patch: { repeatCount: 100, benefitAr: 'كان الصحابة يعدّون للنبي ﷺ في المجلس الواحد مائة مرة' } },
  { category: 'ISTIGHFAR', order: 6, startsWith: 'اللهم إني ظلمت نفسي ظلما كثيرا', patch: { referenceAr: 'رواه البخاري ومسلم - علّمه النبي ﷺ أبا بكر الصديق رضي الله عنه' } },
  { category: 'ISTIGHFAR', order: 7, startsWith: 'سبحان الله وبحمده، أستغفر الله', patch: { referenceAr: 'رواه مسلم' } },

  // QAYN
  {
    category: 'QAYN', order: 1, startsWith: 'سبحان الله عدد ما خلق',
    patch: {
      textAr: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ',
      repeatCount: 3,
      referenceAr: 'رواه مسلم',
      benefitAr: 'لو وُزنت بما قيل منذ الصباح لوزنتهن',
    },
  },
  { category: 'QAYN', order: 2, startsWith: 'سبحان الله وبحمده', patch: { benefitAr: HITTAT } },
  { category: 'QAYN', order: 4, startsWith: 'قل هو الله أحد', remove: true },
  { category: 'QAYN', order: 7, startsWith: 'رب اغفر وارحم', remove: true },

  // MASJID_AFTER_SALAM
  { category: 'MASJID_AFTER_SALAM', order: 3, startsWith: 'سبحان الله (33)', patch: { referenceAr: 'رواه مسلم - بعد كل صلاة مفروضة' } },
  { category: 'MASJID_AFTER_SALAM', order: 4, startsWith: 'أعوذ بالله من الشيطان الرجيم. الله لا إله إلا هو', patch: { referenceAr: 'رواه النسائي في الكبرى - بعد كل صلاة مكتوبة', benefitAr: KURSI_AFTER_PRAYER } },
  { category: 'MASJID_AFTER_SALAM', order: 5, startsWith: 'اللهم اجعل قلبي ساكنا', remove: true },
  { category: 'MASJID_AFTER_SALAM', order: 6, startsWith: 'اللهم لا تدخلني جنة', remove: true },
];

/** Letters-only key: ignores diacritics, punctuation, spacing and alef spelling (إِلَٰه vs إله). */
function fingerprint(text: string): string {
  return normalizeArabicForSearch(text).replace(/[^\u0621-\u064A]/g, '').replace(/\u0627/g, '');
}

export function textMatchesPrefix(textAr: string, startsWith: string): boolean {
  return fingerprint(textAr).startsWith(fingerprint(startsWith));
}

export type LegacyAdhkarItem = {
  orderInCategory: number;
  textAr: string;
  repeatCount: number;
  referenceAr?: string | null;
  benefitAr?: string | null;
};

export type CorrectionOutcome<T> =
  | { kind: 'keep'; item: T }
  | { kind: 'patch'; item: T; rule: AdhkarCorrection }
  | { kind: 'remove'; item: T; rule: AdhkarCorrection };

/** Classifies each legacy item of one category. Throws if a rule's target row is missing or does not match. */
export function planCategoryCorrections<T extends LegacyAdhkarItem>(
  category: AdhkarCategoryKey,
  items: readonly T[],
): CorrectionOutcome<T>[] {
  const rules = ADHKAR_CORRECTIONS_2026.filter((r) => r.category === category);
  for (const rule of rules) {
    const target = items.find((i) => i.orderInCategory === rule.order);
    if (!target || !textMatchesPrefix(target.textAr, rule.startsWith)) {
      throw new Error(`Adhkar correction target not found: ${category} #${rule.order} «${rule.startsWith}»`);
    }
  }
  return items.map((item) => {
    const rule = rules.find((r) => r.order === item.orderInCategory);
    if (!rule) return { kind: 'keep', item };
    return rule.remove ? { kind: 'remove', item, rule } : { kind: 'patch', item, rule };
  });
}

/** Pure application for seed/fallback data: drops removed items, patches the rest, renumbers 1..n. */
export function applyCategoryCorrections<T extends LegacyAdhkarItem>(category: AdhkarCategoryKey, items: readonly T[]): T[] {
  return planCategoryCorrections(category, items)
    .filter((o) => o.kind !== 'remove')
    .map((o, idx) => {
      const patched = o.kind === 'patch' ? { ...o.item, ...o.rule.patch } : { ...o.item };
      return { ...patched, orderInCategory: idx + 1 };
    });
}

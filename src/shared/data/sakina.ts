/**
 * «سكينة» — what to read when you feel something: ayat, adhkar and a word of the Prophet ﷺ for each feeling.
 *
 * Nothing here is new religious text except the hadith below, and each of those is checked word for word against the
 * hadith editions by scripts/test-sakina.ts (al-Tirmidhi / Abu Dawud only when al-Albani grades them sahih).
 * - Ayat are verse keys only. The app renders them from its own Quran text (never a copy kept here). `check` is a
 *   few words of the passage used by the test to prove each key points at the intended ayah; it is not sent.
 * - Adhkar are references into the reviewed adhkar catalog (category + order), resolved at request time, so a
 *   correction to the catalog shows here automatically.
 * Titles describe the feeling only; there is no diagnosis, advice or AI text.
 */
import type { AdhkarCategoryKey } from './adhkar-catalog';

export const SAKINA_VERSION = 1;

export type SakinaAyahRange = { surah: number; from: number; to: number; check: string };
export type SakinaAdhkarRef = { category: AdhkarCategoryKey; order: number };
export type SakinaHadith = {
  id: string;
  leadAr: string;
  textAr: string;
  collection: 'bukhari' | 'muslim' | 'tirmidhi' | 'abudawud';
  number: number;
  referenceAr: string;
};
export type SakinaMood = {
  id: string;
  titleAr: string;
  titleEn: string;
  /** How the user would say it, shown on the chip: «أشعر بالقلق». */
  feelingAr: string;
  feelingEn: string;
  iconKey: string;
  ayat: SakinaAyahRange[];
  adhkar: SakinaAdhkarRef[];
  hadith: string[];
};

const PROPHET = 'قال رسول الله ﷺ:';

export const SAKINA_HADITH: Record<string, SakinaHadith> = {
  tawakkul: { id: 'tawakkul', leadAr: PROPHET, collection: 'tirmidhi', number: 2344, referenceAr: 'رواه الترمذي (2344) وصححه الألباني',
    textAr: 'لَوْ أَنَّكُمْ كُنْتُمْ تَوَكَّلُونَ عَلَى اللَّهِ حَقَّ تَوَكُّلِهِ لَرُزِقْتُمْ كَمَا تُرْزَقُ الطَّيْرُ تَغْدُو خِمَاصًا وَتَرُوحُ بِطَانًا' },
  expiation: { id: 'expiation', leadAr: PROPHET, collection: 'bukhari', number: 5641, referenceAr: 'رواه البخاري (5641)',
    textAr: 'مَا يُصِيبُ الْمُسْلِمَ مِنْ نَصَبٍ وَلاَ وَصَبٍ وَلاَ هَمٍّ وَلاَ حُزْنٍ وَلاَ أَذًى وَلاَ غَمٍّ حَتَّى الشَّوْكَةِ يُشَاكُهَا، إِلاَّ كَفَّرَ اللَّهُ بِهَا مِنْ خَطَايَاهُ' },
  believerAffair: { id: 'believerAffair', leadAr: PROPHET, collection: 'muslim', number: 2999, referenceAr: 'رواه مسلم (2999)',
    textAr: 'عَجَبًا لأَمْرِ الْمُؤْمِنِ إِنَّ أَمْرَهُ كُلَّهُ خَيْرٌ وَلَيْسَ ذَاكَ لأَحَدٍ إِلاَّ لِلْمُؤْمِنِ إِنْ أَصَابَتْهُ سَرَّاءُ شَكَرَ فَكَانَ خَيْرًا لَهُ وَإِنْ أَصَابَتْهُ ضَرَّاءُ صَبَرَ فَكَانَ خَيْرًا لَهُ' },
  strongOne: { id: 'strongOne', leadAr: PROPHET, collection: 'bukhari', number: 6114, referenceAr: 'رواه البخاري (6114)',
    textAr: 'لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ' },
  sitDown: { id: 'sitDown', leadAr: PROPHET, collection: 'abudawud', number: 4782, referenceAr: 'رواه أبو داود (4782) وصححه الألباني',
    textAr: 'إِذَا غَضِبَ أَحَدُكُمْ وَهُوَ قَائِمٌ فَلْيَجْلِسْ فَإِنْ ذَهَبَ عَنْهُ الْغَضَبُ وَإِلاَّ فَلْيَضْطَجِعْ' },
  dontBeAngry: { id: 'dontBeAngry', leadAr: 'أنَّ رجلًا قال للنبي ﷺ: أوصني، قال:', collection: 'bukhari', number: 6116, referenceAr: 'رواه البخاري (6116)',
    textAr: 'لاَ تَغْضَبْ' },
  forgiveAll: { id: 'forgiveAll', leadAr: 'قال رسول الله ﷺ فيما روى عن الله تبارك وتعالى:', collection: 'muslim', number: 2577, referenceAr: 'رواه مسلم (2577)',
    textAr: 'يَا عِبَادِي إِنَّكُمْ تُخْطِئُونَ بِاللَّيْلِ وَالنَّهَارِ وَأَنَا أَغْفِرُ الذُّنُوبَ جَمِيعًا فَاسْتَغْفِرُونِي أَغْفِرْ لَكُمْ' },
  praiseAfterFood: { id: 'praiseAfterFood', leadAr: PROPHET, collection: 'muslim', number: 2734, referenceAr: 'رواه مسلم (2734)',
    textAr: 'إِنَّ اللَّهَ لَيَرْضَى عَنِ الْعَبْدِ أَنْ يَأْكُلَ الأَكْلَةَ فَيَحْمَدَهُ عَلَيْهَا أَوْ يَشْرَبَ الشَّرْبَةَ فَيَحْمَدَهُ عَلَيْهَا' },
  withHim: { id: 'withHim', leadAr: PROPHET, collection: 'bukhari', number: 7405, referenceAr: 'رواه البخاري (7405)',
    textAr: 'يَقُولُ اللَّهُ تَعَالَى أَنَا عِنْدَ ظَنِّ عَبْدِي بِي، وَأَنَا مَعَهُ إِذَا ذَكَرَنِي' },
  strongBeliever: { id: 'strongBeliever', leadAr: PROPHET, collection: 'muslim', number: 2664, referenceAr: 'رواه مسلم (2664)',
    textAr: 'الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ وَفِي كُلٍّ خَيْرٌ احْرِصْ عَلَى مَا يَنْفَعُكَ وَاسْتَعِنْ بِاللَّهِ وَلاَ تَعْجِزْ' },
};

const a = (surah: number, from: number, to: number, check: string): SakinaAyahRange => ({ surah, from, to, check });
const d = (category: AdhkarCategoryKey, order: number): SakinaAdhkarRef => ({ category, order });

export const SAKINA_MOODS: readonly SakinaMood[] = [
  { id: 'anxious', titleAr: 'القلق والخوف', titleEn: 'Worry and fear', feelingAr: 'أشعر بالقلق', feelingEn: 'I feel anxious', iconKey: 'cloud',
    ayat: [a(13, 28, 28, 'ألا بذكر الله تطمئن القلوب'), a(65, 2, 3, 'ومن يتوكل على الله فهو حسبه'), a(9, 51, 51, 'قل لن يصيبنا إلا ما كتب الله لنا'), a(2, 286, 286, 'لا يكلف الله نفسا إلا وسعها')],
    adhkar: [d('DISTRESS', 2), d('MORNING', 7), d('DISTRESS', 6), d('DISTRESS', 4)], hadith: ['tawakkul'] },
  { id: 'sad', titleAr: 'الحزن', titleEn: 'Sadness', feelingAr: 'أشعر بالحزن', feelingEn: 'I feel sad', iconKey: 'rain',
    ayat: [a(94, 5, 6, 'فإن مع العسر يسرا'), a(9, 40, 40, 'لا تحزن إن الله معنا'), a(93, 3, 5, 'ما ودعك ربك وما قلى'), a(12, 86, 86, 'إنما أشكو بثي وحزني إلى الله')],
    adhkar: [d('DISTRESS', 2), d('DISTRESS', 4), d('GENERAL_WIRD', 5)], hadith: ['expiation'] },
  { id: 'distressed', titleAr: 'الضيق والكرب', titleEn: 'Distress', feelingAr: 'أنا في ضيق', feelingEn: 'I am in distress', iconKey: 'storm',
    ayat: [a(21, 87, 88, 'لا إله إلا أنت سبحانك إني كنت من الظالمين'), a(27, 62, 62, 'أمن يجيب المضطر إذا دعاه ويكشف السوء'), a(2, 214, 214, 'ألا إن نصر الله قريب'), a(3, 173, 173, 'حسبنا الله ونعم الوكيل')],
    adhkar: [d('DISTRESS', 1), d('DISTRESS', 3), d('DISTRESS', 5), d('DISTRESS', 6)], hadith: ['believerAffair'] },
  { id: 'angry', titleAr: 'الغضب', titleEn: 'Anger', feelingAr: 'أنا غاضب', feelingEn: 'I am angry', iconKey: 'flame',
    ayat: [a(3, 134, 134, 'والكاظمين الغيظ والعافين عن الناس'), a(42, 37, 37, 'وإذا ما غضبوا هم يغفرون'), a(7, 200, 200, 'من الشيطان نزغ فاستعذ بالله'), a(41, 34, 34, 'ادفع بالتي هي أحسن')],
    adhkar: [d('DAILY_SITUATIONS', 2)], hadith: ['strongOne', 'sitDown', 'dontBeAngry'] },
  { id: 'guilty', titleAr: 'الذنب والندم', titleEn: 'Guilt and regret', feelingAr: 'أشعر بالذنب', feelingEn: 'I feel guilty', iconKey: 'leaf',
    ayat: [a(39, 53, 53, 'لا تقنطوا من رحمة الله إن الله يغفر الذنوب جميعا'), a(4, 110, 110, 'ثم يستغفر الله يجد الله غفورا رحيما'), a(3, 135, 136, 'ذكروا الله فاستغفروا لذنوبهم'), a(25, 70, 70, 'يبدل الله سيئاتهم حسنات')],
    adhkar: [d('ISTIGHFAR', 3), d('ISTIGHFAR', 6), d('ISTIGHFAR', 4), d('ISTIGHFAR', 5)], hadith: ['forgiveAll'] },
  { id: 'grateful', titleAr: 'الشكر والفرح', titleEn: 'Gratitude and joy', feelingAr: 'أشعر بالامتنان', feelingEn: 'I feel grateful', iconKey: 'sun',
    ayat: [a(14, 7, 7, 'لئن شكرتم لأزيدنكم'), a(2, 152, 152, 'فاذكروني أذكركم واشكروا لي ولا تكفرون'), a(16, 18, 18, 'وإن تعدوا نعمة الله لا تحصوها'), a(27, 40, 40, 'هذا من فضل ربي ليبلوني')],
    adhkar: [d('AFTER_PRAYER', 11), d('DAILY_SITUATIONS', 1), d('QAYN', 1)], hadith: ['believerAffair', 'praiseAfterFood'] },
  { id: 'lonely', titleAr: 'الوحدة', titleEn: 'Loneliness', feelingAr: 'أشعر بالوحدة', feelingEn: 'I feel lonely', iconKey: 'moon',
    ayat: [a(2, 186, 186, 'وإذا سألك عبادي عني فإني قريب'), a(50, 16, 16, 'ونحن أقرب إليه من حبل الوريد'), a(58, 7, 7, 'ما يكون من نجوى ثلاثة إلا هو رابعهم'), a(20, 46, 46, 'لا تخافا إنني معكما أسمع وأرى')],
    adhkar: [d('GENERAL_WIRD', 5), d('COMPREHENSIVE_DUA', 4)], hadith: ['withHim'] },
  { id: 'sick', titleAr: 'المرض والتعب', titleEn: 'Illness and fatigue', feelingAr: 'أنا مريض أو متعب', feelingEn: 'I am ill or tired', iconKey: 'heart',
    ayat: [a(26, 80, 80, 'وإذا مرضت فهو يشفين'), a(17, 82, 82, 'ما هو شفاء ورحمة للمؤمنين'), a(21, 83, 84, 'أني مسني الضر وأنت أرحم الراحمين'), a(2, 155, 157, 'وبشر الصابرين')],
    adhkar: [d('SICK', 1), d('SICK', 2), d('SICK', 5), d('SICK', 7)], hadith: ['expiation'] },
  { id: 'unmotivated', titleAr: 'الفتور والكسل', titleEn: 'Low motivation', feelingAr: 'أشعر بالفتور', feelingEn: 'I feel unmotivated', iconKey: 'spark',
    ayat: [a(29, 69, 69, 'والذين جاهدوا فينا لنهدينهم سبلنا'), a(94, 7, 8, 'فإذا فرغت فانصب'), a(3, 139, 139, 'ولا تهنوا ولا تحزنوا وأنتم الأعلون'), a(53, 39, 39, 'وأن ليس للإنسان إلا ما سعى')],
    adhkar: [d('DISTRESS', 2), d('GENERAL_WIRD', 1), d('COMPREHENSIVE_DUA', 2), d('COMPREHENSIVE_DUA', 3)], hadith: ['strongBeliever'] },
  { id: 'confused', titleAr: 'الحيرة في قرار', titleEn: 'Unsure about a decision', feelingAr: 'أنا محتار', feelingEn: 'I am unsure what to do', iconKey: 'compass',
    ayat: [a(2, 216, 216, 'وعسى أن تكرهوا'), a(3, 159, 159, 'فإذا عزمت فتوكل على الله'), a(65, 3, 3, 'ومن يتوكل على الله فهو حسبه')],
    adhkar: [d('ISTIKHARA', 1)], hadith: ['tawakkul'] },
];

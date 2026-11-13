/**
 * Hajj and Umrah guide: the steps as the Prophet ﷺ performed them, each with its evidence.
 *
 * - Hadith texts are copied from the hadith editions and checked letter and vowel by scripts/test-hajj-umrah.ts
 *   (Abu Dawud / al-Tirmidhi only when al-Albani grades them sahih or hasan). Corrections of edition typos are listed
 *   in HAJJ_TEXT_CORRECTIONS and checked too.
 * - Ayat are verse keys only (rendered by the app); `check` proves each key in the test and is not sent.
 * - The step texts are short and stay with what the evidence shows. Points on which the schools differ (which acts
 *   are pillars, special cases such as illness, menstruation or forgetting) are left to scholars; NOTICE says so.
 */
export const HAJJ_GUIDE_VERSION = 1;

export const HAJJ_NOTICE_AR =
  'دليل مختصر لصفة الحج والعمرة كما ثبتت في السنة. تختلف المذاهب في تفصيل الأركان والواجبات وفي الحالات الخاصة (كالمرض والحيض والنسيان)، فاسأل أهل العلم أو المرشد المعتمد في حملتك.';
export const HAJJ_NOTICE_EN =
  'A short guide to Hajj and Umrah as shown in the Sunnah. Schools differ on which acts are pillars or obligations and on special cases (illness, menstruation, forgetting); ask a scholar or your group\'s guide.';

export type HajjHadith = { id: string; leadAr: string; textAr: string; collection: 'bukhari' | 'muslim' | 'tirmidhi' | 'abudawud'; number: number; referenceAr: string };
export type HajjAyah = { surah: number; from: number; to: number; check: string };
export type HajjEvidence = { kind: 'hadith'; id: string } | ({ kind: 'ayah' } & HajjAyah);
export type HajjStep = {
  id: string;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  pointsAr: string[];
  /** A tap counter in the app (laps, stones). */
  counter?: { target: number; unitAr: string; unitEn: string };
  evidence: HajjEvidence[];
  /** Dhu al-Hijjah days this step belongs to (Hajj only). */
  dhulHijjahDays?: number[];
  /** Links to existing areas of the app instead of repeating them. */
  related?: { titleAr: string; deepLink: string }[];
};

const BUKHARI = (n: number) => `رواه البخاري (${n})`;
const MUSLIM = (n: number) => `رواه مسلم (${n})`;
const JABIR = 'رواه مسلم (1218) من حديث جابر في صفة حجة النبي ﷺ';

/** Edition typos corrected in the text shown (from → to); the test checks the edition still reads `from`. */
export const HAJJ_TEXT_CORRECTIONS: { id: string; from: string; to: string; reason: string }[] = [
  { id: 'safaDhikr', from: 'عَلَى كَلِّ شَىْءٍ', to: 'عَلَى كُلِّ شَىْءٍ', reason: 'Vowel typo in the edition (كُلّ).' },
];

const h = (id: string, collection: HajjHadith['collection'], number: number, referenceAr: string, leadAr: string, textAr: string): HajjHadith =>
  ({ id, collection, number, referenceAr, leadAr, textAr });

export const HAJJ_HADITH: Record<string, HajjHadith> = Object.fromEntries([
  h('talbiyah', 'bukhari', 1549, BUKHARI(1549), 'تلبية رسول الله ﷺ:', 'لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لاَ شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ، لاَ شَرِيكَ لَكَ'),
  h('mawaqit', 'bukhari', 1524, BUKHARI(1524), 'عن ابن عباس رضي الله عنهما أن النبي ﷺ', 'وَقَّتَ لأَهْلِ الْمَدِينَةِ ذَا الْحُلَيْفَةِ، وَلأَهْلِ الشَّأْمِ الْجُحْفَةَ، وَلأَهْلِ نَجْدٍ قَرْنَ الْمَنَازِلِ، وَلأَهْلِ الْيَمَنِ يَلَمْلَمَ، هُنَّ لَهُنَّ وَلِمَنْ أَتَى عَلَيْهِنَّ مِنْ غَيْرِهِنَّ، مِمَّنْ أَرَادَ الْحَجَّ وَالْعُمْرَةَ'),
  h('belowMiqat', 'bukhari', 1524, BUKHARI(1524), 'وفي الحديث نفسه:', 'وَمَنْ كَانَ دُونَ ذَلِكَ فَمِنْ حَيْثُ أَنْشَأَ، حَتَّى أَهْلُ مَكَّةَ مِنْ مَكَّةَ'),
  h('dhatIrq', 'bukhari', 1531, BUKHARI(1531), 'قال عمر رضي الله عنه لأهل العراق:', 'فَانْظُرُوا حَذْوَهَا مِنْ طَرِيقِكُمْ فَحَدَّ لَهُمْ ذَاتَ عِرْقٍ'),
  h('izarRida', 'bukhari', 1545, BUKHARI(1545), 'عن ابن عباس رضي الله عنهما في خروج النبي ﷺ من المدينة:', 'وَلَبِسَ إِزَارَهُ وَرِدَاءَهُ، هُوَ وَأَصْحَابُهُ'),
  h('perfume', 'bukhari', 1539, BUKHARI(1539), 'قالت عائشة رضي الله عنها:', 'كُنْتُ أُطَيِّبُ رَسُولَ اللَّهِ صلى الله عليه وسلم لإِحْرَامِهِ حِينَ يُحْرِمُ، وَلِحِلِّهِ قَبْلَ أَنْ يَطُوفَ بِالْبَيْتِ'),
  h('menClothes', 'bukhari', 1542, BUKHARI(1542), 'سُئل رسول الله ﷺ: ما يلبس المحرم من الثياب؟ فقال:', 'لاَ يَلْبَسُ الْقُمُصَ وَلاَ الْعَمَائِمَ وَلاَ السَّرَاوِيلاَتِ وَلاَ الْبَرَانِسَ وَلاَ الْخِفَافَ'),
  h('noPerfume', 'bukhari', 1542, BUKHARI(1542), 'وفي الحديث نفسه:', 'وَلاَ تَلْبَسُوا مِنَ الثِّيَابِ شَيْئًا مَسَّهُ الزَّعْفَرَانُ أَوْ وَرْسٌ'),
  h('womenIhram', 'bukhari', 1838, BUKHARI(1838), 'قال رسول الله ﷺ:', 'وَلاَ تَنْتَقِبِ الْمَرْأَةُ الْمُحْرِمَةُ وَلاَ تَلْبَسِ الْقُفَّازَيْنِ'),
  h('noMarriage', 'muslim', 1409, MUSLIM(1409), 'قال رسول الله ﷺ:', 'لاَ يَنْكِحُ الْمُحْرِمُ وَلاَ يُنْكَحُ وَلاَ يَخْطُبُ'),
  h('threeTypes', 'bukhari', 1562, BUKHARI(1562), 'قالت عائشة رضي الله عنها: خرجنا مع رسول الله ﷺ عام حجة الوداع،', 'فَمِنَّا مَنْ أَهَلَّ بِعُمْرَةٍ، وَمِنَّا مَنْ أَهَلَّ بِحَجَّةٍ وَعُمْرَةٍ، وَمِنَّا مَنْ أَهَلَّ بِالْحَجِّ'),
  h('ramal', 'muslim', 1218, JABIR, 'قال جابر رضي الله عنه في طواف النبي ﷺ:', 'فَرَمَلَ ثَلاَثًا وَمَشَى أَرْبَعًا ثُمَّ نَفَذَ إِلَى مَقَامِ إِبْرَاهِيمَ - عَلَيْهِ السَّلاَمُ - فَقَرَأَ وَاتَّخِذُوا مِنْ مَقَامِ إِبْرَاهِيمَ مُصَلًّى فَجَعَلَ الْمَقَامَ بَيْنَهُ وَبَيْنَ الْبَيْتِ'),
  h('betweenCorners', 'abudawud', 1892, 'رواه أبو داود (1892) وحسّنه الألباني', 'قال عبد الله بن السائب: سمعت رسول الله ﷺ يقول ما بين الركنين:', 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ'),
  h('abdau', 'muslim', 1218, JABIR, 'فلما دنا ﷺ من الصفا قرأ: ﴿إن الصفا والمروة من شعائر الله﴾ وقال:', 'أَبْدَأُ بِمَا بَدَأَ اللَّهُ بِهِ فَبَدَأَ بِالصَّفَا فَرَقِيَ عَلَيْهِ حَتَّى رَأَى الْبَيْتَ فَاسْتَقْبَلَ الْقِبْلَةَ فَوَحَّدَ اللَّهَ وَكَبَّرَهُ'),
  h('safaDhikr', 'muslim', 1218, JABIR, 'وقال ﷺ على الصفا:', 'لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَىْءٍ قَدِيرٌ لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ أَنْجَزَ وَعْدَهُ وَنَصَرَ عَبْدَهُ وَهَزَمَ الأَحْزَابَ وَحْدَهُ'),
  h('valley', 'muslim', 1218, JABIR, 'ثم نزل ﷺ إلى المروة', 'حَتَّى إِذَا انْصَبَّتْ قَدَمَاهُ فِي بَطْنِ الْوَادِي سَعَى'),
  h('marwah', 'muslim', 1218, JABIR, 'فلما أتى ﷺ المروة', 'فَفَعَلَ عَلَى الْمَرْوَةِ كَمَا فَعَلَ عَلَى الصَّفَا'),
  h('shave', 'bukhari', 1727, BUKHARI(1727), 'قال رسول الله ﷺ:', 'اللَّهُمَّ ارْحَمِ الْمُحَلِّقِينَ قَالُوا وَالْمُقَصِّرِينَ يَا رَسُولَ اللَّهِ قَالَ اللَّهُمَّ ارْحَمِ الْمُحَلِّقِينَ قَالُوا وَالْمُقَصِّرِينَ يَا رَسُولَ اللَّهِ قَالَ وَالْمُقَصِّرِينَ'),
  h('womenShorten', 'abudawud', 1984, 'رواه أبو داود (1984) وصححه الألباني', 'قال رسول الله ﷺ:', 'لَيْسَ عَلَى النِّسَاءِ حَلْقٌ إِنَّمَا عَلَى النِّسَاءِ التَّقْصِيرُ'),
  h('tarwiyah', 'muslim', 1218, JABIR, 'قال جابر رضي الله عنه:', 'فَلَمَّا كَانَ يَوْمُ التَّرْوِيَةِ تَوَجَّهُوا إِلَى مِنًى فَأَهَلُّوا بِالْحَجِّ'),
  h('minaPrayers', 'muslim', 1218, JABIR, 'وركب رسول الله ﷺ', 'فَصَلَّى بِهَا الظُّهْرَ وَالْعَصْرَ وَالْمَغْرِبَ وَالْعِشَاءَ وَالْفَجْرَ'),
  h('arafahPrayer', 'muslim', 1218, JABIR, 'وفي عرفة:', 'ثُمَّ أَذَّنَ ثُمَّ أَقَامَ فَصَلَّى الظُّهْرَ ثُمَّ أَقَامَ فَصَلَّى الْعَصْرَ وَلَمْ يُصَلِّ بَيْنَهُمَا شَيْئًا'),
  h('untilSunset', 'muslim', 1218, JABIR, 'ثم ركب ﷺ حتى أتى الموقف', 'فَلَمْ يَزَلْ وَاقِفًا حَتَّى غَرَبَتِ الشَّمْسُ'),
  h('calmly', 'muslim', 1218, JABIR, 'ودفع ﷺ من عرفة وهو يقول بيده اليمنى:', 'أَيُّهَا النَّاسُ السَّكِينَةَ السَّكِينَةَ'),
  h('hajjArafah', 'tirmidhi', 889, 'رواه الترمذي (889) وصححه الألباني', 'قال رسول الله ﷺ:', 'الْحَجُّ عَرَفَةُ مَنْ جَاءَ لَيْلَةَ جَمْعٍ قَبْلَ طُلُوعِ الْفَجْرِ فَقَدْ أَدْرَكَ الْحَجَّ أَيَّامُ مِنًى ثَلاَثَةٌ فَمَنْ تَعَجَّلَ فِي يَوْمَيْنِ فَلاَ إِثْمَ عَلَيْهِ وَمَنْ تَأَخَّرَ فَلاَ إِثْمَ عَلَيْهِ'),
  h('arafahDua', 'tirmidhi', 3585, 'رواه الترمذي (3585) وحسّنه الألباني', 'قال رسول الله ﷺ:', 'خَيْرُ الدُّعَاءِ دُعَاءُ يَوْمِ عَرَفَةَ وَخَيْرُ مَا قُلْتُ أَنَا وَالنَّبِيُّونَ مِنْ قَبْلِي لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ'),
  h('arafahFreed', 'muslim', 1348, MUSLIM(1348), 'قال رسول الله ﷺ:', 'مَا مِنْ يَوْمٍ أَكْثَرَ مِنْ أَنْ يُعْتِقَ اللَّهُ فِيهِ عَبْدًا مِنَ النَّارِ مِنْ يَوْمِ عَرَفَةَ'),
  h('muzdalifah', 'muslim', 1218, JABIR, 'قال جابر رضي الله عنه:', 'حَتَّى أَتَى الْمُزْدَلِفَةَ فَصَلَّى بِهَا الْمَغْرِبَ وَالْعِشَاءَ بِأَذَانٍ وَاحِدٍ وَإِقَامَتَيْنِ'),
  h('untilBright', 'muslim', 1218, JABIR, 'ثم أتى ﷺ المشعر الحرام فاستقبل القبلة فدعاه وكبّره وهلّله ووحّده', 'فَلَمْ يَزَلْ وَاقِفًا حَتَّى أَسْفَرَ جِدًّا'),
  h('weakEarly', 'bukhari', 1678, BUKHARI(1678), 'قال ابن عباس رضي الله عنهما:', 'أَنَا مِمَّنْ قَدَّمَ النَّبِيُّ صلى الله عليه وسلم لَيْلَةَ الْمُزْدَلِفَةِ فِي ضَعَفَةِ أَهْلِهِ'),
  h('aqabah', 'muslim', 1218, JABIR, 'قال جابر رضي الله عنه:', 'حَتَّى أَتَى الْجَمْرَةَ الَّتِي عِنْدَ الشَّجَرَةِ فَرَمَاهَا بِسَبْعِ حَصَيَاتٍ يُكَبِّرُ مَعَ كُلِّ حَصَاةٍ مِنْهَا'),
  h('nahr', 'muslim', 1218, JABIR, 'قال جابر رضي الله عنه:', 'ثُمَّ انْصَرَفَ إِلَى الْمَنْحَرِ فَنَحَرَ'),
  h('ifadah', 'muslim', 1218, JABIR, 'ثم ركب رسول الله ﷺ', 'فَأَفَاضَ إِلَى الْبَيْتِ فَصَلَّى بِمَكَّةَ الظُّهْرَ'),
  h('noHarm', 'bukhari', 1736, BUKHARI(1736), 'عن عبد الله بن عمرو رضي الله عنهما في يوم النحر:', 'فَمَا سُئِلَ يَوْمَئِذٍ عَنْ شَىْءٍ قُدِّمَ وَلاَ أُخِّرَ إِلاَّ قَالَ افْعَلْ وَلاَ حَرَجَ'),
  h('afterZawal', 'bukhari', 1746, BUKHARI(1746), 'قال ابن عمر رضي الله عنهما:', 'كُنَّا نَتَحَيَّنُ، فَإِذَا زَالَتِ الشَّمْسُ رَمَيْنَا'),
  h('threeJamarat', 'bukhari', 1751, BUKHARI(1751), 'عن ابن عمر رضي الله عنهما أنه', 'كَانَ يَرْمِي الْجَمْرَةَ الدُّنْيَا بِسَبْعِ حَصَيَاتٍ، يُكَبِّرُ عَلَى إِثْرِ كُلِّ حَصَاةٍ، ثُمَّ يَتَقَدَّمُ حَتَّى يُسْهِلَ فَيَقُومَ مُسْتَقْبِلَ الْقِبْلَةِ فَيَقُومُ طَوِيلاً، وَيَدْعُو وَيَرْفَعُ يَدَيْهِ، ثُمَّ يَرْمِي الْوُسْطَى'),
  h('aqabahNoStop', 'bukhari', 1751, 'رواه البخاري (1751)، وقال ابن عمر في آخره: هكذا رأيت النبي ﷺ يفعله', 'وفي الحديث نفسه:', 'ثُمَّ يَرْمِي جَمْرَةَ ذَاتِ الْعَقَبَةِ مِنْ بَطْنِ الْوَادِي، وَلاَ يَقِفُ عِنْدَهَا'),
  h('farewell', 'bukhari', 1755, BUKHARI(1755), 'قال ابن عباس رضي الله عنهما:', 'أُمِرَ النَّاسُ أَنْ يَكُونَ آخِرُ عَهْدِهِمْ بِالْبَيْتِ، إِلاَّ أَنَّهُ خُفِّفَ عَنِ الْحَائِضِ'),
  h('takeRites', 'muslim', 1297, MUSLIM(1297), 'قال رسول الله ﷺ:', 'لِتَأْخُذُوا مَنَاسِكَكُمْ فَإِنِّي لاَ أَدْرِي لَعَلِّي لاَ أَحُجُّ بَعْدَ حَجَّتِي هَذِهِ'),
  h('mabrur', 'bukhari', 1773, BUKHARI(1773), 'قال رسول الله ﷺ:', 'الْعُمْرَةُ إِلَى الْعُمْرَةِ كَفَّارَةٌ لِمَا بَيْنَهُمَا، وَالْحَجُّ الْمَبْرُورُ لَيْسَ لَهُ جَزَاءٌ إِلاَّ الْجَنَّةُ'),
  h('likeNewborn', 'bukhari', 1521, BUKHARI(1521), 'قال رسول الله ﷺ:', 'مَنْ حَجَّ لِلَّهِ فَلَمْ يَرْفُثْ وَلَمْ يَفْسُقْ رَجَعَ كَيَوْمِ وَلَدَتْهُ أُمُّهُ'),
].map((x) => [x.id, x]));

const H = (id: string): HajjEvidence => ({ kind: 'hadith', id });
const A = (surah: number, from: number, to: number, check: string): HajjEvidence => ({ kind: 'ayah', surah, from, to, check });

export const UMRAH_STEPS: readonly HajjStep[] = [
  { id: 'ihram', titleAr: 'الإحرام', titleEn: 'Ihram',
    summaryAr: 'الإحرام نية الدخول في النسك، ويكون من الميقات لمن مرّ به وهو يريد العمرة أو الحج.',
    pointsAr: ['يتطيّب الرجل في بدنه قبل الإحرام إن شاء، ويلبس إزارًا ورداءً.', 'تلبس المرأة ثيابها الساترة المعتادة، ولا تلبس النقاب ولا القفازين.', 'ينوي النسك ثم يلبّي ويُكثر من التلبية.'],
    evidence: [H('mawaqit'), H('perfume'), H('izarRida'), H('womenIhram'), H('talbiyah')] },
  { id: 'tawaf', titleAr: 'الطواف', titleEn: 'Tawaf',
    summaryAr: 'الطواف بالكعبة سبعة أشواط، يبدأ كل شوط من الحجر الأسود وينتهي إليه، والكعبة عن يساره.',
    pointsAr: ['يُسنّ للرجل الرَّمَل (الإسراع مع تقارب الخطى) في الأشواط الثلاثة الأولى من أول طواف يطوفه.', 'يقول بين الركن اليماني والحجر الأسود: ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار.', 'ويذكر الله ويدعو بما شاء في سائر الطواف.'],
    counter: { target: 7, unitAr: 'شوط', unitEn: 'lap' },
    evidence: [A(22, 29, 29, 'وليطوفوا بالبيت العتيق'), H('ramal'), H('betweenCorners')] },
  { id: 'tawafPrayer', titleAr: 'ركعتا الطواف', titleEn: 'Two rak\'ahs after tawaf',
    summaryAr: 'يصلي ركعتين خلف مقام إبراهيم إن تيسّر، وإلا ففي أي موضع من المسجد.',
    pointsAr: ['يجعل المقام بينه وبين الكعبة إن تيسّر.'],
    evidence: [A(2, 125, 125, 'واتخذوا من مقام إبراهيم مصلى'), H('ramal')] },
  { id: 'sai', titleAr: 'السعي', titleEn: 'Sa\'i',
    summaryAr: 'السعي بين الصفا والمروة سبعة أشواط، يبدأ بالصفا ويختم بالمروة؛ الذهاب شوط والرجوع شوط.',
    pointsAr: ['إذا دنا من الصفا قرأ: ﴿إن الصفا والمروة من شعائر الله﴾ وقال: أبدأ بما بدأ الله به.', 'يرقى الصفا ويستقبل القبلة فيوحّد الله ويكبّره ويدعو، ويفعل على المروة مثل ذلك.', 'يُسرع الرجل في بطن الوادي، وهو اليوم ما بين العلمين الأخضرين.'],
    counter: { target: 7, unitAr: 'شوط', unitEn: 'lap' },
    evidence: [A(2, 158, 158, 'إن الصفا والمروة من شعائر الله'), H('abdau'), H('safaDhikr'), H('valley'), H('marwah')] },
  { id: 'halq', titleAr: 'الحلق أو التقصير', titleEn: 'Shaving or shortening',
    summaryAr: 'يحلق الرجل رأسه أو يقصّر منه، والحلق أفضل، وتقصّر المرأة من شعرها ولا تحلق. وبذلك تتم العمرة.',
    pointsAr: [],
    evidence: [A(48, 27, 27, 'محلقين رءوسكم ومقصرين'), H('shave'), H('womenShorten')] },
];

export const HAJJ_STEPS: readonly HajjStep[] = [
  { id: 'tarwiyah', titleAr: 'يوم التروية', titleEn: 'Day of Tarwiyah', dhulHijjahDays: [8],
    summaryAr: 'يُحرم بالحج من مكانه ويتوجه إلى منى.',
    pointsAr: ['يصلي بمنى الظهر والعصر والمغرب والعشاء والفجر.', 'يُكثر من التلبية.'],
    evidence: [H('tarwiyah'), H('minaPrayers'), H('talbiyah')] },
  { id: 'arafah', titleAr: 'يوم عرفة', titleEn: 'Day of Arafah', dhulHijjahDays: [9],
    summaryAr: 'أعظم أيام الحج: يسير بعد طلوع الشمس إلى عرفة، ويقف بها ذاكرًا داعيًا حتى تغرب الشمس.',
    pointsAr: ['يصلي الظهر والعصر بأذان واحد وإقامتين.', 'يتأكد أنه داخل حدود عرفة.', 'يتفرغ للذكر والدعاء، وخير الدعاء دعاء يوم عرفة.', 'إذا غربت الشمس دفع إلى مزدلفة بسكينة.'],
    evidence: [H('hajjArafah'), H('arafahPrayer'), H('untilSunset'), H('arafahDua'), H('arafahFreed'), H('calmly')],
    related: [{ titleAr: 'صيام يوم عرفة لغير الحاج', deepLink: '/fasting/sunnah' }] },
  { id: 'muzdalifah', titleAr: 'ليلة مزدلفة', titleEn: 'Night at Muzdalifah', dhulHijjahDays: [9, 10],
    summaryAr: 'يصلي بمزدلفة المغرب والعشاء جمعًا، ويبيت بها حتى يصلي الفجر، ثم يذكر الله ويدعو حتى يُسفر جدًّا.',
    pointsAr: ['يجوز للضعفة من النساء والكبار ومن يقوم عليهم الدفع من مزدلفة بليل.'],
    evidence: [A(2, 198, 198, 'فإذا أفضتم من عرفات فاذكروا الله عند المشعر الحرام'), H('muzdalifah'), H('untilBright'), H('weakEarly')] },
  { id: 'nahr', titleAr: 'يوم النحر', titleEn: 'Day of Sacrifice', dhulHijjahDays: [10],
    summaryAr: 'رمي جمرة العقبة، ثم النحر، ثم الحلق أو التقصير، ثم طواف الإفاضة.',
    pointsAr: ['يرمي جمرة العقبة بسبع حصيات يكبّر مع كل حصاة.', 'ينحر هديه إن كان متمتعًا أو قارنًا.', 'يحلق أو يقصّر.', 'يطوف طواف الإفاضة، ويسعى إن كان عليه سعي.', 'من قدّم شيئًا من هذه الأعمال على غيره فلا حرج.'],
    counter: { target: 7, unitAr: 'حصاة', unitEn: 'pebble' },
    evidence: [H('aqabah'), H('nahr'), A(2, 196, 196, 'فمن تمتع بالعمرة إلى الحج فما استيسر من الهدي'), H('shave'), H('ifadah'), H('noHarm')] },
  { id: 'tashreeq', titleAr: 'أيام التشريق', titleEn: 'Days of Tashreeq', dhulHijjahDays: [11, 12, 13],
    summaryAr: 'المبيت بمنى، ورمي الجمرات الثلاث كل يوم بعد الزوال.',
    pointsAr: ['يرمي الصغرى ثم الوسطى ثم العقبة، كل واحدة بسبع حصيات يكبّر مع كل حصاة.', 'يقف بعد الصغرى والوسطى مستقبل القبلة يدعو طويلًا، ولا يقف بعد العقبة.', 'من تعجّل في يومين (الحادي عشر والثاني عشر) فلا إثم عليه، ومن تأخر إلى الثالث عشر فلا إثم عليه.', 'يُكثر من ذكر الله في هذه الأيام.'],
    counter: { target: 7, unitAr: 'حصاة', unitEn: 'pebble' },
    evidence: [A(2, 203, 203, 'واذكروا الله في أيام معدودات'), H('afterZawal'), H('threeJamarat'), H('aqabahNoStop'), H('hajjArafah')] },
  { id: 'farewell', titleAr: 'طواف الوداع', titleEn: 'Farewell tawaf',
    summaryAr: 'آخر ما يفعله الحاج قبل سفره من مكة الطواف بالبيت، ويسقط عن الحائض.',
    pointsAr: [],
    counter: { target: 7, unitAr: 'شوط', unitEn: 'lap' },
    evidence: [H('farewell')] },
];

export const MAWAQIT = [
  { id: 'dhul-hulayfah', nameAr: 'ذو الحليفة', nameEn: 'Dhul Hulayfah', todayAr: 'أبيار علي', forAr: 'أهل المدينة ومن مرّ بها' },
  { id: 'juhfah', nameAr: 'الجحفة', nameEn: 'Al-Juhfah', todayAr: 'يُحرم الناس اليوم من رابغ', forAr: 'أهل الشام ومن جاء من جهتها كمصر والمغرب' },
  { id: 'qarn', nameAr: 'قرن المنازل', nameEn: 'Qarn al-Manazil', todayAr: 'السيل الكبير', forAr: 'أهل نجد ومن مرّ بها' },
  { id: 'yalamlam', nameAr: 'يلملم', nameEn: 'Yalamlam', todayAr: 'السعدية', forAr: 'أهل اليمن ومن مرّ بها' },
  { id: 'dhat-irq', nameAr: 'ذات عرق', nameEn: 'Dhat Irq', todayAr: 'الضريبة', forAr: 'أهل العراق ومن مرّ بها' },
] as const;

export const IHRAM_INFO = {
  miqatPointsAr: [
    'من كان مسكنه دون الميقات أحرم من مكانه، وأهل مكة يُحرمون بالحج من مكة.',
    'من سافر جوًا أو بحرًا أحرم إذا حاذى الميقات.',
  ],
  miqatEvidence: [H('mawaqit'), H('belowMiqat'), H('dhatIrq')],
  prohibitionsAr: [
    'لبس الرجل ما فُصّل على البدن كالقميص والسراويل والعمامة والخف.',
    'النقاب والقفازان للمرأة.',
    'الطيب بعد الإحرام.',
    'أخذ الشعر.',
    'الرفث والفسوق والجدال.',
    'قتل الصيد.',
    'عقد النكاح وخطبته.',
  ],
  prohibitionsEvidence: [H('menClothes'), H('noPerfume'), H('womenIhram'), A(2, 196, 196, 'ولا تحلقوا رءوسكم حتى يبلغ الهدي محله'),
    A(2, 197, 197, 'فلا رفث ولا فسوق ولا جدال في الحج'), A(5, 95, 95, 'لا تقتلوا الصيد وأنتم حرم'), H('noMarriage')],
  types: [
    { id: 'tamattu', nameAr: 'التمتع', descriptionAr: 'يُحرم بالعمرة في أشهر الحج ويتحلّل منها، ثم يُحرم بالحج في العام نفسه، وعليه هدي.' },
    { id: 'qiran', nameAr: 'القِران', descriptionAr: 'يُحرم بالعمرة والحج معًا ويبقى على إحرامه إلى يوم النحر، وعليه هدي.' },
    { id: 'ifrad', nameAr: 'الإفراد', descriptionAr: 'يُحرم بالحج وحده، ولا هدي عليه.' },
  ],
  typesEvidence: [H('threeTypes'), A(2, 196, 196, 'فمن تمتع بالعمرة إلى الحج فما استيسر من الهدي')],
};

export const HAJJ_VIRTUES: HajjEvidence[] = [
  A(3, 97, 97, 'ولله على الناس حج البيت من استطاع إليه سبيلا'), A(22, 27, 27, 'وأذن في الناس بالحج يأتوك رجالا'),
  H('likeNewborn'), H('mabrur'), H('takeRites'),
];

/**
 * دروس التجويد (6 Nov 2026): 12 lessons following Tuhfat al-Atfal (al-Jamzuri), plus qalqala and tafkhim from
 * al-Jazariyya, for Hafs an Asim (the app's mushaf). Every example is a word from a cited ayah; TAJWEED_EXAMPLES
 * lets the tests check that each example word is really in that ayah.
 */
import type { ItemDef, QuranRef } from './types';

const DRAFT = { status: 'DRAFT' } as const;

type Ex = { word: string; surah: number; ayah: number };
const ex = (word: string, surah: number, ayah: number): Ex => ({ word, surah, ayah });
const refs = (list: Ex[]): QuranRef[] => list.map(e => ({ surah: e.surah, from: e.ayah }));
const exLine = (list: Ex[]) => `أمثلة: ${list.map(e => `«${e.word}»`).join('، ')}.`;

const IZHAR = [ex('من ءامن', 2, 62), ex('منهم', 2, 75), ex('من عمل', 16, 97), ex('من غل', 7, 43), ex('من خوف', 106, 4)];
const IDGHAM_GHUNNA = [ex('من يقول', 2, 8), ex('من نور', 24, 40), ex('من وال', 13, 11)];
const IDGHAM_NO_GHUNNA = [ex('من لدنه', 18, 2), ex('من ربهم', 2, 5)];
const IDGHAM_EXCEPT = [ex('صنوان', 13, 4), ex('قنوان', 6, 99), ex('بنيان', 61, 4)];
const IQLAB = [ex('من بعد', 2, 27), ex('أنبئهم', 2, 33), ex('سميع بصير', 22, 61)];
const IKHFA = [ex('ينفقون', 2, 3), ex('أنتم', 2, 85), ex('من قبل', 2, 25), ex('كنتم', 2, 23), ex('منضود', 56, 29)];
const MEEM_IKHFA = [ex('ترميهم بحجارة', 105, 4)];
const MEEM_IDGHAM = [ex('ولكم ما كسبتم', 2, 134)];
const MEEM_IZHAR = [ex('ألم تر', 105, 1), ex('عليهم ولا الضالين', 1, 7)];
const MUSHADDAD = [ex('إن الذين', 2, 6), ex('ثم يميتكم', 2, 28), ex('الناس', 114, 1)];
const LAM_QAMARI = [ex('الحمد', 1, 2), ex('القمر', 54, 1)];
const LAM_SHAMSI = [ex('الشمس', 91, 1), ex('الساعة', 54, 1)];
const MADD_TABII = [ex('قال', 2, 33), ex('نستعين', 1, 5)];
const MADD_MUTTASIL = [ex('السماء', 2, 19), ex('جاء', 110, 1)];
const MADD_MUNFASIL = [ex('بما أنزل', 2, 4), ex('يأيها', 2, 21)];
const MADD_LAZIM = [ex('الضالين', 1, 7), ex('الحاقة', 69, 1), ex('الم', 2, 1)];
const QALQALA = [ex('وتب', 111, 1), ex('الفلق', 113, 1), ex('أحد', 112, 1), ex('يجعلون', 2, 19)];
const LAFZ_TAFKHIM = [ex('شهد الله', 3, 18), ex('رسول الله', 48, 29)];
const LAFZ_TARQIQ = [ex('الحمد لله', 1, 2)];
const RA = [ex('ربنا', 2, 201), ex('رزقا', 2, 22)];

/** For tests: every example word must occur in its ayah. */
export const TAJWEED_EXAMPLES: Ex[] = [
  ...IZHAR, ...IDGHAM_GHUNNA, ...IDGHAM_NO_GHUNNA, ...IDGHAM_EXCEPT, ...IQLAB, ...IKHFA, ...MEEM_IKHFA, ...MEEM_IDGHAM, ...MEEM_IZHAR,
  ...MUSHADDAD, ...LAM_QAMARI, ...LAM_SHAMSI, ...MADD_TABII, ...MADD_MUTTASIL, ...MADD_MUNFASIL, ...MADD_LAZIM, ...QALQALA,
  ...LAFZ_TAFKHIM, ...LAFZ_TARQIQ, ...RA,
];

export const TAJWEED: ItemDef[] = [
  {
    id: 'tajweed-muqaddima',
    order: 10,
    titleAr: 'ما التجويد؟ وما حكمه؟',
    titleEn: 'What tajweed is and why it matters',
    summaryAr: 'التجويد: إعطاء كل حرف حقه من المخرج والصفات. أمر الله بترتيل القرآن، والماهر بالقرآن مع السفرة الكرام البررة، والذي يتتعتع فيه وهو عليه شاق له أجران.',
    sections: [
      {
        titleAr: 'ورتّل القرآن ترتيلًا',
        paragraphsAr: [
          'التجويد لغةً: التحسين. واصطلاحًا: إخراج كل حرف من مخرجه، مع إعطائه حقه من الصفات والأحكام.',
          'وقراءة القرآن بالتجويد بقدر ما يحفظ الحروف من اللحن الذي يغيّر المعنى واجبة، وتعلّم قواعده بالتفصيل فرض كفاية.',
        ],
        quran: [{ surah: 73, from: 4 }],
      },
      {
        titleAr: 'الماهر بالقرآن',
        paragraphsAr: [
          'قال النبي ﷺ: «الماهر بالقرآن مع السفرة الكرام البررة، والذي يقرأ القرآن ويتتعتع فيه وهو عليه شاق له أجران».',
          'وسُئل أنس عن قراءة النبي ﷺ فقال: كانت مدًّا، ثم قرأ «بسم الله الرحمن الرحيم» يمدّ ببسم الله، ويمدّ بالرحمن، ويمدّ بالرحيم.',
        ],
        reflectionAr: 'لا تنتظر أن تتقن لتبدأ؛ من يتتعتع وهو يتعلّم له أجران.',
        hadith: [
          { collection: 'muslim', phrase: 'الماهر بالقرآن مع السفرة الكرام البررة', number: 798 },
          { collection: 'bukhari', phrase: 'كانت مدا ثم قرأ بسم الله الرحمن الرحيم يمد ببسم الله ويمد بالرحمن ويمد بالرحيم', number: 5046 },
        ],
      },
      {
        titleAr: 'كيف تستفيد من هذه الدروس؟',
        paragraphsAr: [
          'كل درس فيه القاعدة ثم أمثلة من المصحف. اضغط على الآية لتسمعها بصوت القارئ وتلاحظ الحكم. والتجويد يُتلقّى بالمشافهة، فاجعل هذه الدروس مساعدة لك مع معلّم.',
        ],
        quran: [{ surah: 1, from: 2 }],
      },
    ],
    keyPointsAr: ['التجويد: إعطاء الحروف حقها.', 'الماهر مع السفرة، والمتتعتع له أجران.', 'التجويد يُتلقّى بالسماع والمشافهة.'],
    quiz: [
      { questionAr: 'ما أجر من يقرأ القرآن ويتتعتع فيه وهو عليه شاق؟', optionsAr: ['له أجران', 'لا أجر له', 'أجر واحد'], correctIndex: 0, explanationAr: 'صحيح مسلم ٧٩٨.' },
      { questionAr: 'كيف وصف أنس قراءة النبي ﷺ؟', optionsAr: ['كانت مدًّا', 'كانت سريعة', 'كانت بلا صوت'], correctIndex: 0, explanationAr: 'صحيح البخاري ٥٠٤٦.' },
    ],
    review: DRAFT,
  },
  {
    id: 'tajweed-istiadha',
    order: 20,
    titleAr: 'الاستعاذة والبسملة',
    titleEn: 'Seeking refuge and the Basmala',
    summaryAr: 'يُستعاذ بالله عند بدء القراءة، وتُقرأ البسملة في أول كل سورة إلا سورة التوبة.',
    sections: [
      {
        titleAr: 'فاستعذ بالله',
        paragraphsAr: [
          'قال الله: «فإذا قرأت القرآن فاستعذ بالله من الشيطان الرجيم». وصيغتها المشهورة: أعوذ بالله من الشيطان الرجيم.',
          'ويُجهر بها إذا كانت القراءة جهرية أمام من يستمع، ويُسرّ بها في الصلاة وفي القراءة السرية.',
        ],
        quran: [{ surah: 16, from: 98 }],
      },
      {
        titleAr: 'البسملة',
        paragraphsAr: [
          'تُقرأ البسملة في أول كل سورة إلا سورة التوبة، ويجوز قراءتها أو تركها إذا بدأت من وسط سورة.',
          'وعند الانتقال من سورة إلى أخرى لك ثلاثة أوجه: قطع الجميع (الوقف على آخر السورة ثم على البسملة)، أو وصل الجميع، أو قطع الأول ووصل البسملة بأول السورة. أما وصل آخر السورة بالبسملة ثم الوقف عليها فلا يجوز.',
        ],
        quran: [{ surah: 1, from: 1 }],
      },
    ],
    keyPointsAr: ['الاستعاذة قبل القراءة.', 'البسملة في أول كل سورة إلا التوبة.'],
    quiz: [
      { questionAr: 'أي سورة لا تبدأ بالبسملة؟', optionsAr: ['التوبة', 'الفاتحة', 'الإخلاص'], correctIndex: 0, explanationAr: 'سورة التوبة (براءة).' },
      { questionAr: 'ما الوجه الممنوع بين السورتين؟', optionsAr: ['وصل آخر السورة بالبسملة ثم الوقف عليها', 'قطع الجميع', 'وصل الجميع'], correctIndex: 0, explanationAr: 'لئلا يُظن أن البسملة آخر السورة.' },
    ],
    review: DRAFT,
  },
  {
    id: 'tajweed-izhar',
    order: 30,
    titleAr: 'النون الساكنة والتنوين: الإظهار',
    titleEn: 'Noon sakinah and tanween: izhar',
    summaryAr: 'للنون الساكنة والتنوين أربعة أحكام: الإظهار، والإدغام، والإقلاب، والإخفاء. الإظهار: إذا جاء بعدها أحد حروف الحلق الستة (ء هـ ع ح غ خ) تُنطق النون واضحة بلا غنة زائدة.',
    sections: [
      {
        titleAr: 'أربعة أحكام',
        paragraphsAr: [
          'النون الساكنة: نون لا حركة عليها، تثبت لفظًا وخطًّا. والتنوين: نون ساكنة زائدة تلحق آخر الاسم لفظًا لا خطًّا (ـًـٍـٌ).',
          'ولهما أربعة أحكام بحسب الحرف الذي بعدهما: الإظهار، والإدغام، والإقلاب، والإخفاء.',
        ],
        quran: [{ surah: 2, from: 62 }],
      },
      {
        titleAr: 'الإظهار الحلقي',
        paragraphsAr: [
          'حروفه ستة من الحلق: الهمزة، والهاء، والعين، والحاء، والغين، والخاء. وجمعها الشيخ الجمزوري في أوائل كلمات: «أخي هاك علمًا حازه غير خاسر».',
          'إذا جاء أحدها بعد النون الساكنة أو التنوين، في كلمة أو كلمتين، أُظهرت النون من مخرجها بلا غنة زائدة.',
          exLine(IZHAR),
        ],
        quran: refs(IZHAR),
      },
    ],
    keyPointsAr: ['حروف الإظهار: ء هـ ع ح غ خ.', 'الإظهار: نطق النون واضحة بلا غنة زائدة.'],
    quiz: [
      { questionAr: 'كم حرفًا للإظهار الحلقي؟', optionsAr: ['ستة', 'أربعة', 'خمسة عشر'], correctIndex: 0, explanationAr: 'ء هـ ع ح غ خ.' },
      { questionAr: 'ما حكم النون في «من خوف»؟', optionsAr: ['إظهار', 'إخفاء', 'إدغام'], correctIndex: 0, explanationAr: 'الخاء من حروف الحلق.' },
    ],
    review: DRAFT,
  },
  {
    id: 'tajweed-idgham',
    order: 40,
    titleAr: 'الإدغام',
    titleEn: 'Idgham (merging)',
    summaryAr: 'حروف الإدغام ستة مجموعة في «يرملون». في (ي ن م و) يكون الإدغام بغنة، وفي (ل ر) بغير غنة. ويُشترط أن يكون في كلمتين.',
    sections: [
      {
        titleAr: 'الإدغام بغنة: ينمو',
        paragraphsAr: [
          'إذا جاء بعد النون الساكنة أو التنوين حرف من حروف «ينمو» (ي ن م و) في كلمة أخرى، أُدغمت النون فيه مع غنة بمقدار حركتين.',
          exLine(IDGHAM_GHUNNA),
        ],
        quran: refs(IDGHAM_GHUNNA),
      },
      {
        titleAr: 'الإدغام بغير غنة: ل ر',
        paragraphsAr: [
          'إذا جاء بعدهما اللام أو الراء أُدغمت النون إدغامًا كاملًا بلا غنة.',
          exLine(IDGHAM_NO_GHUNNA),
        ],
        quran: refs(IDGHAM_NO_GHUNNA),
      },
      {
        titleAr: 'إذا كانا في كلمة واحدة',
        paragraphsAr: [
          'إذا جاءت النون الساكنة وبعدها الياء أو الواو في كلمة واحدة فلا إدغام، بل تُظهر، ويُسمّى إظهارًا مطلقًا. وورد في القرآن في أربع كلمات: «الدنيا»، «قنوان»، «صنوان»، «بنيان».',
          exLine(IDGHAM_EXCEPT),
        ],
        quran: refs(IDGHAM_EXCEPT),
      },
    ],
    keyPointsAr: ['يرملون: حروف الإدغام.', 'ينمو بغنة، ول ر بغير غنة.', 'لا إدغام في كلمة واحدة: الدنيا، قنوان، صنوان، بنيان.'],
    quiz: [
      { questionAr: 'ما حكم النون في «من ربهم»؟', optionsAr: ['إدغام بغير غنة', 'إدغام بغنة', 'إظهار'], correctIndex: 0, explanationAr: 'الراء من حرفي الإدغام بلا غنة.' },
      { questionAr: 'لماذا تُظهر النون في «بنيان»؟', optionsAr: ['لأن النون والياء في كلمة واحدة', 'لأن الياء حرف حلق', 'لأنها آخر الآية'], correctIndex: 0, explanationAr: 'الإظهار المطلق.' },
    ],
    review: DRAFT,
  },
  {
    id: 'tajweed-iqlab',
    order: 50,
    titleAr: 'الإقلاب',
    titleEn: 'Iqlab (conversion)',
    summaryAr: 'إذا جاء بعد النون الساكنة أو التنوين حرف الباء قُلبت النون ميمًا مخفاة مع الغنة. وفي المصحف علامته ميم صغيرة.',
    sections: [
      {
        titleAr: 'حرف واحد: الباء',
        paragraphsAr: [
          'الإقلاب: قلب النون الساكنة أو التنوين ميمًا مخفاة عند الباء، مع غنة بمقدار حركتين، في كلمة أو كلمتين. وتجد فوقها في المصحف ميمًا صغيرة.',
          exLine(IQLAB),
        ],
        quran: refs(IQLAB),
      },
    ],
    keyPointsAr: ['حرف الإقلاب: الباء وحدها.', 'تُقلب النون ميمًا مخفاة مع الغنة.'],
    quiz: [
      { questionAr: 'ما حرف الإقلاب؟', optionsAr: ['الباء', 'الميم', 'النون'], correctIndex: 0, explanationAr: 'حرف واحد.' },
      { questionAr: 'ما علامة الإقلاب في المصحف؟', optionsAr: ['ميم صغيرة', 'سكون', 'شدة'], correctIndex: 0, explanationAr: 'ميم صغيرة فوق النون أو بدل التنوين.' },
    ],
    review: DRAFT,
  },
  {
    id: 'tajweed-ikhfa',
    order: 60,
    titleAr: 'الإخفاء الحقيقي',
    titleEn: 'Ikhfa (concealment)',
    summaryAr: 'الإخفاء عند باقي الحروف الخمسة عشر: تُنطق النون بين الإظهار والإدغام مع غنة بمقدار حركتين.',
    sections: [
      {
        titleAr: 'خمسة عشر حرفًا',
        paragraphsAr: [
          'حروف الإخفاء هي الباقية بعد حروف الإظهار والإدغام والإقلاب، وجمعها الجمزوري في أوائل كلمات هذا البيت: «صف ذا ثنا كم جاد شخص قد سما، دم طيبًا زد في تقى ضع ظالما».',
          'وهي: ص ذ ث ك ج ش ق س د ط ز ف ت ض ظ.',
        ],
        quran: [{ surah: 2, from: 3 }],
      },
      {
        titleAr: 'كيف يُنطق؟',
        paragraphsAr: [
          'تُنطق النون بصفة بين الإظهار والإدغام، خالية من التشديد، مع غنة بمقدار حركتين، ويتهيأ اللسان لمخرج الحرف الذي بعدها.',
          exLine(IKHFA),
        ],
        quran: refs(IKHFA),
      },
    ],
    keyPointsAr: ['الإخفاء عند ١٥ حرفًا.', 'غنة بمقدار حركتين.'],
    quiz: [
      { questionAr: 'كم حرفًا للإخفاء الحقيقي؟', optionsAr: ['خمسة عشر', 'ستة', 'أربعة'], correctIndex: 0, explanationAr: 'أوائل كلمات «صف ذا ثنا…».' },
      { questionAr: 'ما حكم النون في «ينفقون»؟', optionsAr: ['إخفاء', 'إظهار', 'إقلاب'], correctIndex: 0, explanationAr: 'الفاء من حروف الإخفاء.' },
    ],
    review: DRAFT,
  },
  {
    id: 'tajweed-meem',
    order: 70,
    titleAr: 'أحكام الميم الساكنة',
    titleEn: 'Meem sakinah',
    summaryAr: 'للميم الساكنة ثلاثة أحكام: الإخفاء الشفوي عند الباء، والإدغام عند الميم، والإظهار الشفوي عند باقي الحروف، وأشدّه عند الواو والفاء.',
    sections: [
      {
        titleAr: 'الإخفاء الشفوي',
        paragraphsAr: ['إذا جاء بعد الميم الساكنة باء أُخفيت الميم مع الغنة.', exLine(MEEM_IKHFA)],
        quran: refs(MEEM_IKHFA),
      },
      {
        titleAr: 'إدغام المثلين الصغير',
        paragraphsAr: ['إذا جاء بعد الميم الساكنة ميم أُدغمت فيها مع الغنة.', exLine(MEEM_IDGHAM)],
        quran: refs(MEEM_IDGHAM),
      },
      {
        titleAr: 'الإظهار الشفوي',
        paragraphsAr: [
          'عند باقي الحروف تُظهر الميم، ويُحرص على إظهارها عند الواو والفاء لقرب مخرجهما منها، فلا تُخفى.',
          exLine(MEEM_IZHAR),
        ],
        quran: refs(MEEM_IZHAR),
      },
    ],
    keyPointsAr: ['الميم + ب: إخفاء شفوي.', 'الميم + م: إدغام.', 'الميم + باقي الحروف: إظهار، وأشده عند الواو والفاء.'],
    quiz: [
      { questionAr: 'ما حكم الميم في «ترميهم بحجارة»؟', optionsAr: ['إخفاء شفوي', 'إظهار شفوي', 'إدغام'], correctIndex: 0, explanationAr: 'جاءت بعدها باء.' },
      { questionAr: 'عند أي حرفين يُحرص على إظهار الميم أكثر؟', optionsAr: ['الواو والفاء', 'الباء والميم', 'اللام والراء'], correctIndex: 0, explanationAr: 'لقرب مخرجهما من الميم.' },
    ],
    review: DRAFT,
  },
  {
    id: 'tajweed-mushaddad',
    order: 80,
    titleAr: 'النون والميم المشددتان',
    titleEn: 'Doubled noon and meem',
    summaryAr: 'كل نون مشددة وكل ميم مشددة تُنطق بغنة كاملة بمقدار حركتين، وتُسمّى «حرف غنة مشدد».',
    sections: [
      {
        titleAr: 'غنة بحركتين',
        paragraphsAr: [
          'قال الجمزوري: «وغُنَّ ميمًا ثم نونًا شُدّدا، وسمِّ كلًّا حرف غنة بدا». فالنون المشددة والميم المشددة تُغنّان بمقدار حركتين في الوصل والوقف.',
          exLine(MUSHADDAD),
        ],
        quran: refs(MUSHADDAD),
      },
    ],
    keyPointsAr: ['النون والميم المشددتان: غنة بحركتين.'],
    quiz: [
      { questionAr: 'كم مقدار الغنة في «إنّ» و«ثمّ»؟', optionsAr: ['حركتان', 'أربع حركات', 'ست حركات'], correctIndex: 0, explanationAr: 'غنة كاملة بحركتين.' },
    ],
    review: DRAFT,
  },
  {
    id: 'tajweed-lam',
    order: 90,
    titleAr: 'لام التعريف: القمرية والشمسية',
    titleEn: 'The definite article: lunar and solar lam',
    summaryAr: 'لام «ال» تُظهر قبل الحروف القمرية الأربعة عشر المجموعة في «ابغِ حجك وخف عقيمه»، وتُدغم في الحروف الشمسية الباقية.',
    sections: [
      {
        titleAr: 'اللام القمرية',
        paragraphsAr: [
          'تُظهر اللام وتُنطق ساكنة قبل أربعة عشر حرفًا مجموعة في: «ابغِ حجّك وخف عقيمه».',
          exLine(LAM_QAMARI),
        ],
        quran: refs(LAM_QAMARI),
      },
      {
        titleAr: 'اللام الشمسية',
        paragraphsAr: [
          'تُدغم اللام في الحرف الذي بعدها في باقي الحروف الأربعة عشر، فلا تُنطق، ويُشدّد الحرف الذي بعدها.',
          exLine(LAM_SHAMSI),
          'وفي آية القمر اجتمعتا: «اقتربت الساعة» لام شمسية، و«القمر» لام قمرية.',
        ],
        quran: refs(LAM_SHAMSI),
      },
    ],
    keyPointsAr: ['القمرية تُظهر: ابغِ حجك وخف عقيمه.', 'الشمسية تُدغم ويُشدد ما بعدها.'],
    quiz: [
      { questionAr: 'ما نوع اللام في «الشمس»؟', optionsAr: ['شمسية', 'قمرية', 'لام فعل'], correctIndex: 0, explanationAr: 'تُدغم في الشين.' },
      { questionAr: 'ما نوع اللام في «القمر»؟', optionsAr: ['قمرية', 'شمسية', 'لا لام فيها'], correctIndex: 0, explanationAr: 'القاف من «ابغ حجك وخف عقيمه».' },
    ],
    review: DRAFT,
  },
  {
    id: 'tajweed-madd',
    order: 100,
    titleAr: 'المدود',
    titleEn: 'Prolongation (madd)',
    summaryAr: 'حروف المد ثلاثة (ا و ي). المد الطبيعي حركتان. فإن جاء بعده همز أو سكون صار فرعيًّا: المتصل والمنفصل (٤ أو ٥ حركات)، واللازم (٦)، والعارض للسكون (٢ أو ٤ أو ٦).',
    sections: [
      {
        titleAr: 'المد الطبيعي',
        paragraphsAr: [
          'حروف المد: الألف الساكنة المفتوح ما قبلها، والواو الساكنة المضموم ما قبلها، والياء الساكنة المكسور ما قبلها، وجمعها «واي».',
          'المد الطبيعي: لا يأتي بعده همز ولا سكون، ويُمد حركتين.',
          exLine(MADD_TABII),
        ],
        quran: refs(MADD_TABII),
      },
      {
        titleAr: 'المد المتصل والمنفصل',
        paragraphsAr: [
          'المتصل الواجب: حرف المد وبعده همز في كلمة واحدة، ويُمد ٤ أو ٥ حركات لحفص من طريق الشاطبية. ' + exLine(MADD_MUTTASIL),
          'المنفصل الجائز: حرف المد في آخر كلمة والهمز في أول الكلمة التالية، ويُمد ٤ أو ٥ حركات لحفص من طريق الشاطبية. ' + exLine(MADD_MUNFASIL),
        ],
        quran: [...refs(MADD_MUTTASIL), ...refs(MADD_MUNFASIL)],
      },
      {
        titleAr: 'المد اللازم والعارض للسكون',
        paragraphsAr: [
          'اللازم: حرف المد وبعده سكون أصلي ثابت وصلًا ووقفًا، ويُمد ست حركات لزومًا. ومنه ما في أوائل السور مثل «الم». ' + exLine(MADD_LAZIM),
          'العارض للسكون: حرف المد وبعده حرف سُكّن لأجل الوقف، مثل الوقف على «نستعين»، ويجوز فيه ٢ أو ٤ أو ٦ حركات.',
        ],
        quran: refs(MADD_LAZIM),
      },
    ],
    keyPointsAr: ['حروف المد: ا و ي.', 'الطبيعي ٢، المتصل والمنفصل ٤ أو ٥، اللازم ٦، العارض ٢ أو ٤ أو ٦.'],
    quiz: [
      { questionAr: 'كم حركة يُمد المد اللازم؟', optionsAr: ['ست', 'اثنتان', 'أربع'], correctIndex: 0, explanationAr: 'مثل «الضالين».' },
      { questionAr: 'ما نوع المد في «السماء»؟', optionsAr: ['متصل', 'منفصل', 'طبيعي'], correctIndex: 0, explanationAr: 'المد والهمز في كلمة واحدة.' },
      { questionAr: 'ما نوع المد في «بما أنزل»؟', optionsAr: ['منفصل', 'متصل', 'لازم'], correctIndex: 0, explanationAr: 'المد في كلمة والهمز في الكلمة التالية.' },
    ],
    review: DRAFT,
  },
  {
    id: 'tajweed-qalqala',
    order: 110,
    titleAr: 'القلقلة',
    titleEn: 'Qalqala (echoing)',
    summaryAr: 'حروف القلقلة خمسة مجموعة في «قطب جد». إذا سكنت اضطرب الصوت بها حتى يُسمع لها نبرة قوية، وأقواها عند الوقف.',
    sections: [
      {
        titleAr: 'قطب جد',
        paragraphsAr: [
          'حروف القلقلة: القاف، والطاء، والباء، والجيم، والدال. إذا سكنت في وسط الكلمة أو آخرها اضطرب المخرج بها حتى يُسمع لها نبرة قوية.',
          'ومراتبها: كبرى عند الوقف على حرف قلقلة مشدد مثل «وتبّ»، ووسطى عند الوقف على حرف قلقلة غير مشدد مثل «الفلق» و«أحد»، وصغرى إذا كان الحرف ساكنًا في وسط الكلمة مثل «يجعلون».',
          exLine(QALQALA),
        ],
        quran: refs(QALQALA),
      },
    ],
    keyPointsAr: ['قطب جد.', 'أقوى القلقلة عند الوقف.'],
    quiz: [
      { questionAr: 'ما حروف القلقلة؟', optionsAr: ['قطب جد', 'يرملون', 'ينمو'], correctIndex: 0, explanationAr: 'ق ط ب ج د.' },
      { questionAr: 'متى تكون القلقلة أقوى؟', optionsAr: ['عند الوقف', 'في وسط الكلمة', 'عند الوصل'], correctIndex: 0, explanationAr: 'مثل الوقف على «الفلق».' },
    ],
    review: DRAFT,
  },
  {
    id: 'tajweed-tafkhim',
    order: 120,
    titleAr: 'التفخيم والترقيق: لام لفظ الجلالة والراء',
    titleEn: 'Heavy and light letters: the lam of Allah and the ra',
    summaryAr: 'حروف الاستعلاء «خص ضغط قظ» مفخّمة دائمًا. ولام لفظ الجلالة تُفخّم بعد فتح أو ضم وتُرقّق بعد كسر. والراء تُفخّم إذا فُتحت أو ضُمّت وتُرقّق إذا كُسرت.',
    sections: [
      {
        titleAr: 'حروف الاستعلاء',
        paragraphsAr: ['سبعة حروف تُنطق مفخّمة دائمًا، مجموعة في «خص ضغط قظ»: الخاء، والصاد، والضاد، والغين، والطاء، والقاف، والظاء.'],
        quran: [{ surah: 1, from: 7 }],
      },
      {
        titleAr: 'لام لفظ الجلالة',
        paragraphsAr: [
          'تُفخّم إذا سبقها فتح أو ضم. ' + exLine(LAFZ_TAFKHIM),
          'وتُرقّق إذا سبقها كسر. ' + exLine(LAFZ_TARQIQ),
        ],
        quran: [...refs(LAFZ_TAFKHIM), ...refs(LAFZ_TARQIQ)],
      },
      {
        titleAr: 'الراء',
        paragraphsAr: [
          'تُفخّم الراء إذا كانت مفتوحة أو مضمومة، وتُرقّق إذا كانت مكسورة. ولأحوال الراء الساكنة تفصيل تتعلّمه مع المعلّم.',
          exLine(RA),
        ],
        quran: refs(RA),
      },
    ],
    keyPointsAr: ['خص ضغط قظ مفخّمة دائمًا.', 'لام الجلالة تُفخّم بعد فتح أو ضم، وتُرقّق بعد كسر.', 'الراء المفتوحة والمضمومة مفخّمة، والمكسورة مرققة.'],
    quiz: [
      { questionAr: 'كيف تُنطق اللام في «الحمد لله»؟', optionsAr: ['مرققة', 'مفخمة', 'مدغمة'], correctIndex: 0, explanationAr: 'سبقها كسر.' },
      { questionAr: 'كيف تُنطق اللام في «رسول الله»؟', optionsAr: ['مفخمة', 'مرققة', 'مخفاة'], correctIndex: 0, explanationAr: 'سبقها ضم.' },
      { questionAr: 'ما حروف الاستعلاء؟', optionsAr: ['خص ضغط قظ', 'قطب جد', 'يرملون'], correctIndex: 0, explanationAr: 'سبعة حروف مفخمة دائمًا.' },
    ],
    review: DRAFT,
  },
];

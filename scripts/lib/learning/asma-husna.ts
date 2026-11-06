/**
 * أسماء الله الحسنى (6 Nov 2026): names of Allah that appear in the Quran (and a few in Sahih hadith), each with
 * the ayah where it occurs, its meaning, and how belief in it shapes daily life.
 * The well-known list of 99 names is not in the two Sahihs, so names are taken from the Quran and Sahih hadith.
 * ASMA_REFS lets the tests check that every cited ayah really contains the name.
 */
import type { HadithRef, ItemDef, QuranRef } from './types';

const DRAFT = { status: 'DRAFT' } as const;

type NameDef = {
  id: string;
  /** Names as they appear (with ال), e.g. ['الرحمن', 'الرحيم']. */
  names: string[];
  titleEn: string;
  meaningAr: string[];
  /** The ayah(s) where the name occurs. Each must contain every name word listed in `inAyah`. */
  quran: { ref: QuranRef; inAyah: string[] }[];
  hadith?: HadithRef[];
  livingAr: string[];
  keyPointsAr: string[];
};

const NAMES: NameDef[] = [
  {
    id: 'ism-allah', names: ['الله'], titleEn: 'Allah',
    meaningAr: ['«الله» علم على الرب سبحانه، وهو أعظم أسمائه، ومعناه: المألوه المعبود بحق. وإليه تُضاف الأسماء كلها: الرحمن والرحيم والملك من أسماء الله.'],
    quran: [{ ref: { surah: 20, from: 14 }, inAyah: ['الله'] }, { ref: { surah: 59, from: 22 }, inAyah: ['الله'] }],
    livingAr: ['من عرف أن الله وحده المعبود بحق لم يتعلّق قلبه بغيره خوفًا ورجاءً ومحبة.'],
    keyPointsAr: ['«الله» أعظم الأسماء، ومعناه المعبود بحق.'],
  },
  {
    id: 'ism-rahman-rahim', names: ['الرحمن', 'الرحيم'], titleEn: 'Ar-Rahman, Ar-Rahim',
    meaningAr: [
      'الرحمن: ذو الرحمة الواسعة التي وسعت كل شيء. الرحيم: الذي يوصل رحمته إلى عباده.',
      'وكتب الله في كتابه: «إن رحمتي سبقت غضبي». ورأى النبي ﷺ امرأة تضم ولدها فقال: «لَله أرحم بعباده من هذه بولدها».',
    ],
    quran: [{ ref: { surah: 1, from: 3 }, inAyah: ['الرحمن', 'الرحيم'] }, { ref: { surah: 59, from: 22 }, inAyah: ['الرحمن', 'الرحيم'] }],
    hadith: [
      { collection: 'bukhari', phrase: 'إن الله كتب كتابا قبل أن يخلق الخلق إن رحمتي سبقت غضبي', number: 7554 },
      { collection: 'bukhari', phrase: 'لله أرحم بعباده من هذه بولدها', number: 5999 },
    ],
    livingAr: ['لا تيأس من رحمة الله مهما كان ذنبك، وكن رحيمًا بالخلق، فالراحمون يرحمهم الرحمن.'],
    keyPointsAr: ['رحمة الله سبقت غضبه.', 'الله أرحم بعباده من الأم بولدها.'],
  },
  {
    id: 'ism-malik-quddus-salam', names: ['الملك', 'القدوس', 'السلام', 'المؤمن', 'المهيمن'], titleEn: 'Al-Malik, Al-Quddus, As-Salam, Al-Mumin, Al-Muhaymin',
    meaningAr: [
      'الملك: المالك لكل شيء المتصرف فيه. القدوس: المنزّه عن كل نقص. السلام: السالم من كل عيب، ومنه السلامة. المؤمن: الذي يؤمّن عباده ويصدّق رسله بالآيات. المهيمن: الرقيب الشاهد على خلقه القائم عليهم.',
    ],
    quran: [{ ref: { surah: 59, from: 23 }, inAyah: ['الملك', 'القدوس', 'السلام', 'المهيمن'] }],
    livingAr: ['الملك الحق هو الله، فلا تذلّ نفسك لغيره. ومن طلب الأمن والسلام فليطلبه من السلام المؤمن.'],
    keyPointsAr: ['خمسة أسماء في آية واحدة من آخر سورة الحشر.'],
  },
  {
    id: 'ism-aziz-jabbar', names: ['العزيز', 'الجبار', 'المتكبر'], titleEn: 'Al-Aziz, Al-Jabbar, Al-Mutakabbir',
    meaningAr: [
      'العزيز: الغالب الذي لا يُغلب، وله العزة جميعًا. الجبار: الذي يجبر كسر عباده ويقهر الجبابرة. المتكبر: المتعالي عن صفات الخلق، والكبرياء له وحده.',
    ],
    quran: [{ ref: { surah: 59, from: 23 }, inAyah: ['العزيز', 'الجبار', 'المتكبر'] }],
    livingAr: ['اطلب العزة من العزيز بطاعته، واطلب جبر قلبك المكسور من الجبار، واترك الكبر لأن الكبرياء لله وحده.'],
    keyPointsAr: ['الجبار من معانيه: الذي يجبر الكسير.', 'الكبرياء لله، والتواضع زينة العبد.'],
  },
  {
    id: 'ism-khaliq-bari-musawwir', names: ['الخالق', 'البارئ', 'المصور'], titleEn: 'Al-Khaliq, Al-Bari, Al-Musawwir',
    meaningAr: [
      'الخالق: الذي أوجد الأشياء من العدم بتقدير. البارئ: الذي أبرز الخلق وميّز بعضه عن بعض. المصور: الذي صوّر كل مخلوق على صورة تخصه.',
    ],
    quran: [{ ref: { surah: 59, from: 24 }, inAyah: ['الخالق', 'المصور'] }],
    livingAr: ['خلقك الله وصوّرك فأحسن صورتك؛ فاشكره على خلقك ولا تحتقر خلق الله في نفسك ولا في غيرك.'],
    keyPointsAr: ['الخلق والتقدير والتصوير لله وحده.'],
  },
  {
    id: 'ism-hayy-qayyum', names: ['الحي', 'القيوم'], titleEn: 'Al-Hayy, Al-Qayyum',
    meaningAr: [
      'الحي: الذي له الحياة الكاملة التي لا يسبقها عدم ولا يلحقها زوال. القيوم: القائم بنفسه، المقيم لغيره، لا تأخذه سِنة ولا نوم.',
      'وقال النبي ﷺ: «إن الله لا ينام ولا ينبغي له أن ينام».',
    ],
    quran: [{ ref: { surah: 2, from: 255 }, inAyah: ['الحي', 'القيوم'] }, { ref: { surah: 3, from: 2 }, inAyah: ['الحي', 'القيوم'] }],
    hadith: [{ collection: 'muslim', phrase: 'إن الله لا ينام ولا ينبغي له أن ينام', number: 179 }],
    livingAr: ['توكّل على الحي الذي لا يموت؛ كل من تعتمد عليه من الناس يغيب أو ينام أو يموت، والله قائم عليك لا يغفل.'],
    keyPointsAr: ['الحي القيوم ذُكرا في آية الكرسي.'],
  },
  {
    id: 'ism-awwal-akhir', names: ['الأول', 'الآخر', 'الظاهر', 'الباطن'], titleEn: 'Al-Awwal, Al-Akhir, Az-Zahir, Al-Batin',
    meaningAr: [
      'فسّرها النبي ﷺ في دعائه: «اللهم أنت الأول فليس قبلك شيء، وأنت الآخر فليس بعدك شيء، وأنت الظاهر فليس فوقك شيء، وأنت الباطن فليس دونك شيء».',
    ],
    quran: [{ ref: { surah: 57, from: 3 }, inAyah: ['الأول', 'الظاهر', 'الباطن'] }],
    hadith: [{ collection: 'muslim', phrase: 'اللهم أنت الأول فليس قبلك شيء وأنت الآخر فليس بعدك شيء وأنت الظاهر فليس فوقك شيء وأنت الباطن فليس دونك شيء', number: 2713 }],
    livingAr: ['كل شيء يبدأ بالله وينتهي إليه، فاجعل بدايتك به ونهايتك إليه.'],
    keyPointsAr: ['أربعة أسماء فسّرها النبي ﷺ بنفسه.'],
  },
  {
    id: 'ism-ahad-samad', names: ['الواحد', 'الأحد', 'الصمد', 'القهار'], titleEn: 'Al-Wahid, Al-Ahad, As-Samad, Al-Qahhar',
    meaningAr: [
      'الواحد الأحد: المتفرد في ذاته وصفاته وأفعاله، لا شريك له ولا مثيل. الصمد: السيد الذي تقصده الخلائق في حوائجها. القهار: الذي قهر كل شيء وخضع له كل شيء.',
    ],
    quran: [{ ref: { surah: 112, from: 1, to: 2 }, inAyah: [] }, { ref: { surah: 13, from: 16 }, inAyah: ['الواحد', 'القهار'] }],
    livingAr: ['اقصد الصمد في كل حاجة صغيرة وكبيرة؛ فهو الذي يُقصد ولا يحتاج إلى أحد.'],
    keyPointsAr: ['الصمد: المقصود في الحوائج.'],
  },
  {
    id: 'ism-sami-basir', names: ['السميع', 'البصير'], titleEn: 'As-Sami, Al-Basir',
    meaningAr: [
      'السميع: الذي يسمع كل صوت، سرًّا وجهرًا، لا تختلط عليه الأصوات. البصير: الذي يرى كل شيء، ظاهره وباطنه.',
      'وقال النبي ﷺ: «إنكم لا تدعون أصمّ ولا غائبًا، إنكم تدعون سميعًا قريبًا».',
    ],
    quran: [{ ref: { surah: 42, from: 11 }, inAyah: ['السميع', 'البصير'] }],
    hadith: [{ collection: 'bukhari', phrase: 'إنكم تدعون سميعا قريبا', number: 4205 }],
    livingAr: ['الله يسمع همسك في السجود ويرى دمعتك في الخلوة، فلا تكتم شكواك عنه، واستحِ أن يراك حيث نهاك.'],
    keyPointsAr: ['الله يسمع الدعاء ولو كان همسًا.'],
  },
  {
    id: 'ism-alim-khabir', names: ['العليم', 'الخبير'], titleEn: 'Al-Alim, Al-Khabir',
    meaningAr: [
      'العليم: الذي أحاط علمه بكل شيء: ما كان وما يكون. الخبير: العليم بدقائق الأمور وخفاياها.',
    ],
    quran: [{ ref: { surah: 66, from: 3 }, inAyah: ['العليم', 'الخبير'] }, { ref: { surah: 67, from: 14 }, inAyah: ['الخبير'] }],
    livingAr: ['لا تشكُ إلى الناس ما يعلمه الله، ويكفيك أن الخبير يعلم ما في قلبك ولو لم تقله.'],
    keyPointsAr: ['«ألا يعلم من خلق وهو اللطيف الخبير».'],
  },
  {
    id: 'ism-latif', names: ['اللطيف'], titleEn: 'Al-Latif',
    meaningAr: [
      'اللطيف: الذي يوصل الخير إلى عباده من حيث لا يشعرون، ويعلم دقائق الأمور. قال يوسف بعد كل ما مرّ به: «إن ربي لطيف لما يشاء».',
    ],
    quran: [{ ref: { surah: 67, from: 14 }, inAyah: ['اللطيف'] }, { ref: { surah: 12, from: 100 }, inAyah: ['لطيف'] }],
    livingAr: ['البئر والسجن كانا طريق يوسف إلى الملك. ثق أن الله يدبّر لك بلطفه وإن لم ترَ الحكمة الآن.'],
    keyPointsAr: ['لطف الله قد يأتي في صورة ابتلاء.'],
  },
  {
    id: 'ism-hakim', names: ['الحكيم'], titleEn: 'Al-Hakim',
    meaningAr: ['الحكيم: الذي يضع كل شيء في موضعه، فلا يقدّر شيئًا عبثًا، وأحكامه كلها عدل وحكمة.'],
    quran: [{ ref: { surah: 2, from: 32 }, inAyah: ['العليم', 'الحكيم'] }],
    livingAr: ['إذا لم تفهم حكمة قدر أو حكم، فقل كما قالت الملائكة: «سبحانك لا علم لنا إلا ما علمتنا إنك أنت العليم الحكيم».'],
    keyPointsAr: ['كل أفعال الله وأحكامه لحكمة.'],
  },
  {
    id: 'ism-ghafur-ghaffar', names: ['الغفور', 'الغفار'], titleEn: 'Al-Ghafur, Al-Ghaffar',
    meaningAr: [
      'الغفور الغفار: الذي يستر الذنوب ويتجاوز عنها مهما كثرت وتكررت. «قل يا عبادي الذين أسرفوا على أنفسهم لا تقنطوا من رحمة الله إن الله يغفر الذنوب جميعًا».',
    ],
    quran: [{ ref: { surah: 39, from: 53 }, inAyah: ['الغفور'] }, { ref: { surah: 71, from: 10 }, inAyah: ['غفارا'] }],
    livingAr: ['أكثر من الاستغفار، فإن الله غفّار لمن يستغفره، ولا تدع الشيطان يقنّطك من التوبة.'],
    keyPointsAr: ['لا ذنب أكبر من مغفرة الله.'],
  },
  {
    id: 'ism-tawwab', names: ['التواب'], titleEn: 'At-Tawwab',
    meaningAr: [
      'التواب: الذي يوفّق عباده للتوبة ثم يقبلها منهم مرة بعد مرة. تاب على آدم حين تلقّى من ربه كلمات.',
      'وقال النبي ﷺ: «لَله أفرح بتوبة عبده» من رجل وجد راحلته بعد أن أضلّها في فلاة.',
    ],
    quran: [{ ref: { surah: 2, from: 37 }, inAyah: ['التواب'] }],
    hadith: [{ collection: 'bukhari', phrase: 'لله أفرح بتوبة عبده', number: 6309 }],
    livingAr: ['كلما رجعت إلى الله وجدته يفرح برجوعك، فلا تؤجّل التوبة.'],
    keyPointsAr: ['الله يفرح بتوبة عبده.'],
  },
  {
    id: 'ism-afuw', names: ['العفو'], titleEn: 'Al-Afuw',
    meaningAr: ['العفو: الذي يمحو الذنوب ويزيل أثرها، والعفو أبلغ من المغفرة لأن فيه محو الذنب.'],
    quran: [{ ref: { surah: 4, from: 99 }, inAyah: ['عفوا', 'غفورا'] }],
    livingAr: ['اعفُ عمن ظلمك؛ فمن أحب أن يعفو الله عنه عفا عن الناس.'],
    keyPointsAr: ['العفو: محو الذنب وأثره.'],
  },
  {
    id: 'ism-rauf-wadud', names: ['الرؤوف', 'الودود'], titleEn: 'Ar-Rauf, Al-Wadud',
    meaningAr: [
      'الرؤوف: شديد الرأفة، والرأفة أرقّ الرحمة. الودود: الذي يحب أولياءه ويتودد إليهم بنعمه، ويحبه عباده.',
    ],
    quran: [{ ref: { surah: 2, from: 143 }, inAyah: ['لرءوف'] }, { ref: { surah: 85, from: 14 }, inAyah: ['الغفور', 'الودود'] }],
    livingAr: ['الله يتودد إليك بالنعم وأنت تعصيه، فكيف لو أطعته؟ تودّد إليه بالطاعة.'],
    keyPointsAr: ['«وهو الغفور الودود»: يغفر ويحب.'],
  },
  {
    id: 'ism-halim', names: ['الحليم'], titleEn: 'Al-Halim',
    meaningAr: [
      'الحليم: الذي لا يعاجل العصاة بالعقوبة، ويمهلهم ليتوبوا. وكان النبي ﷺ يقول عند الكرب: «لا إله إلا الله العظيم الحليم».',
    ],
    quran: [{ ref: { surah: 2, from: 235 }, inAyah: ['حليم'] }, { ref: { surah: 64, from: 17 }, inAyah: ['شكور', 'حليم'] }],
    hadith: [{ collection: 'bukhari', phrase: 'لا إله إلا الله العظيم الحليم', number: 6345 }],
    livingAr: ['حِلم الله عليك فرصة للتوبة لا دعوة للاستمرار، وكن حليمًا مع من أخطأ في حقك.'],
    keyPointsAr: ['دعاء الكرب: لا إله إلا الله العظيم الحليم.'],
  },
  {
    id: 'ism-shakur', names: ['الشكور'], titleEn: 'Ash-Shakur',
    meaningAr: ['الشكور: الذي يجزي على العمل القليل بالثواب الكثير، ولا يضيع عنده مثقال ذرة.'],
    quran: [{ ref: { surah: 35, from: 30 }, inAyah: ['غفور', 'شكور'] }],
    livingAr: ['لا تحتقر عملًا صغيرًا، فإن الله شكور يضاعفه.'],
    keyPointsAr: ['القليل عند الله كثير.'],
  },
  {
    id: 'ism-razzaq', names: ['الرزاق', 'القوي', 'المتين'], titleEn: 'Ar-Razzaq, Al-Qawiyy, Al-Matin',
    meaningAr: ['الرزاق: الذي تكفّل بأرزاق الخلق كلهم. القوي المتين: صاحب القوة الكاملة التي لا يلحقها ضعف.'],
    quran: [{ ref: { surah: 51, from: 58 }, inAyah: ['الرزاق', 'القوة', 'المتين'] }],
    livingAr: ['اسعَ في طلب الرزق بالحلال، واعلم أن الرزاق قد قسمه لك، فلا تطلبه بمعصية.'],
    keyPointsAr: ['الرزق بيد الرزاق، والسعي عبادة.'],
  },
  {
    id: 'ism-wahhab-fattah', names: ['الوهاب', 'الفتاح'], titleEn: 'Al-Wahhab, Al-Fattah',
    meaningAr: [
      'الوهاب: الذي يعطي بلا مقابل ولا سبب. الفتاح: الذي يفتح أبواب الرحمة والرزق، ويحكم بين عباده بالحق.',
    ],
    quran: [{ ref: { surah: 3, from: 8 }, inAyah: ['الوهاب'] }, { ref: { surah: 34, from: 26 }, inAyah: ['الفتاح', 'العليم'] }],
    livingAr: ['ادعُ بدعاء الراسخين: «ربنا لا تزغ قلوبنا بعد إذ هديتنا وهب لنا من لدنك رحمة إنك أنت الوهاب».'],
    keyPointsAr: ['الوهاب يعطي بلا سبب، فلا تيأس إن انقطعت الأسباب.'],
  },
  {
    id: 'ism-karim', names: ['الكريم'], titleEn: 'Al-Karim',
    meaningAr: ['الكريم: كثير الخير، الذي يعطي قبل السؤال، ويعفو مع القدرة. «يا أيها الإنسان ما غرّك بربك الكريم».'],
    quran: [{ ref: { surah: 82, from: 6 }, inAyah: ['الكريم'] }, { ref: { surah: 27, from: 40 }, inAyah: ['كريم'] }],
    livingAr: ['كرم الله لا يُقابل بالجحود. كن كريمًا مع الناس كما يكرمك الله.'],
    keyPointsAr: ['كرم الله ليس سببًا للاغترار به.'],
  },
  {
    id: 'ism-ghani-hamid', names: ['الغني', 'الحميد'], titleEn: 'Al-Ghaniyy, Al-Hamid',
    meaningAr: ['الغني: الذي لا يحتاج إلى أحد، والكل يحتاج إليه. الحميد: المحمود في ذاته وصفاته وأفعاله.'],
    quran: [{ ref: { surah: 35, from: 15 }, inAyah: ['الغني', 'الحميد'] }],
    livingAr: ['«أنتم الفقراء إلى الله»: عبادتك لا تنفع الله، بل تنفعك أنت.'],
    keyPointsAr: ['نحن الفقراء إلى الله، وهو الغني الحميد.'],
  },
  {
    id: 'ism-qarib-mujib', names: ['القريب', 'المجيب'], titleEn: 'Al-Qarib, Al-Mujib',
    meaningAr: [
      'القريب: القريب من عباده بعلمه وإجابته. المجيب: الذي يجيب دعاء الداعين. وينزل ربنا كل ليلة إلى السماء الدنيا حين يبقى ثلث الليل الآخر فيقول: «من يدعوني فأستجيب له؟».',
    ],
    quran: [{ ref: { surah: 11, from: 61 }, inAyah: ['قريب', 'مجيب'] }],
    hadith: [{ collection: 'bukhari', phrase: 'من يدعوني فأستجيب له من يسألني فأعطيه من يستغفرني فأغفر له', number: 1145 }],
    livingAr: ['اغتنم ثلث الليل الآخر، فالله قريب مجيب.'],
    keyPointsAr: ['أرجى أوقات الإجابة: ثلث الليل الآخر.'],
  },
  {
    id: 'ism-wasi', names: ['الواسع'], titleEn: 'Al-Wasi',
    meaningAr: ['الواسع: واسع الرحمة والعلم والعطاء والفضل، لا يضيق بكثرة السائلين.'],
    quran: [{ ref: { surah: 2, from: 115 }, inAyah: ['واسع', 'عليم'] }],
    livingAr: ['لا تستكثر حاجتك على الله، فهو واسع.'],
    keyPointsAr: ['«إن الله واسع عليم».'],
  },
  {
    id: 'ism-wakil', names: ['الوكيل'], titleEn: 'Al-Wakil',
    meaningAr: [
      'الوكيل: الذي يتولّى أمور من توكّل عليه ويكفيه. قالها إبراهيم حين أُلقي في النار، وقالها محمد ﷺ والصحابة حين قيل لهم: إن الناس قد جمعوا لكم: «حسبنا الله ونعم الوكيل».',
    ],
    quran: [{ ref: { surah: 3, from: 173 }, inAyah: ['الوكيل'] }],
    hadith: [{ collection: 'bukhari', phrase: 'حسبنا الله ونعم الوكيل قالها إبراهيم عليه السلام حين ألقي في النار', number: 4563 }],
    livingAr: ['خذ بالأسباب ثم سلّم الأمر للوكيل، وقل عند الخوف: حسبنا الله ونعم الوكيل.'],
    keyPointsAr: ['«حسبنا الله ونعم الوكيل» كلمة إبراهيم ومحمد عليهما السلام عند الشدة.'],
  },
  {
    id: 'ism-hafiz', names: ['الحفيظ', 'المقيت'], titleEn: 'Al-Hafiz, Al-Muqit',
    meaningAr: ['الحفيظ: الذي يحفظ عباده ويحفظ أعمالهم. المقيت: الذي يعطي كل مخلوق قوته، والقادر الحافظ لكل شيء.'],
    quran: [
      { ref: { surah: 11, from: 57 }, inAyah: ['حفيظ'] },
      { ref: { surah: 12, from: 64 }, inAyah: ['حافظا'] },
      { ref: { surah: 4, from: 85 }, inAyah: ['مقيتا'] },
    ],
    livingAr: ['استودع الله أهلك ومالك، فهو خير حافظًا وهو أرحم الراحمين.'],
    keyPointsAr: ['«فالله خير حافظًا».'],
  },
  {
    id: 'ism-raqib-shahid', names: ['الرقيب', 'الشهيد', 'الحسيب'], titleEn: 'Ar-Raqib, Ash-Shahid, Al-Hasib',
    meaningAr: ['الرقيب: المطّلع على كل شيء لا يغيب عنه شيء. الشهيد: الحاضر الذي يشهد كل شيء. الحسيب: الكافي، والمحاسب لعباده على أعمالهم.'],
    quran: [
      { ref: { surah: 4, from: 1 }, inAyah: ['رقيبا'] },
      { ref: { surah: 22, from: 17 }, inAyah: ['شهيد'] },
      { ref: { surah: 4, from: 86 }, inAyah: ['حسيبا'] },
    ],
    livingAr: ['من استحضر أن الرقيب يراه في الخلوة، كان ظاهره وباطنه سواء.'],
    keyPointsAr: ['مراقبة الله أساس الإحسان.'],
  },
  {
    id: 'ism-qadir', names: ['القدير'], titleEn: 'Al-Qadir',
    meaningAr: ['القدير: الذي لا يعجزه شيء، إذا أراد شيئًا قال له كن فيكون.'],
    quran: [{ ref: { surah: 2, from: 20 }, inAyah: ['قدير'] }],
    livingAr: ['ما تراه مستحيلًا يسير على القدير، فلا تقطع رجاءك.'],
    keyPointsAr: ['«إن الله على كل شيء قدير».'],
  },
  {
    id: 'ism-ali-azim', names: ['العلي', 'العظيم', 'الكبير', 'المتعال'], titleEn: 'Al-Aliyy, Al-Azim, Al-Kabir, Al-Mutaal',
    meaningAr: ['العلي المتعال: العالي فوق خلقه بذاته وقدره وقهره. العظيم الكبير: الذي له العظمة والكبرياء، وكل شيء دونه صغير.'],
    quran: [{ ref: { surah: 2, from: 255 }, inAyah: ['العلي', 'العظيم'] }, { ref: { surah: 13, from: 9 }, inAyah: ['الكبير', 'المتعال'] }],
    hadith: [{ collection: 'bukhari', phrase: 'سبحان الله وبحمده سبحان الله العظيم', number: 6682 }],
    livingAr: ['نقول في الركوع «سبحان ربي العظيم» وفي السجود «سبحان ربي الأعلى»، فاستحضر المعنى وأنت تقولها.'],
    keyPointsAr: ['كل كبير دون الله صغير: «الله أكبر».'],
  },
  {
    id: 'ism-haqq-mubin', names: ['الحق', 'المبين'], titleEn: 'Al-Haqq, Al-Mubin',
    meaningAr: [
      'الحق: الثابت الذي لا شك فيه، وقوله حق ووعده حق. المبين: الظاهر البيّن. وكان النبي ﷺ يقول في قيام الليل: «أنت الحق، ووعدك الحق».',
    ],
    quran: [{ ref: { surah: 24, from: 25 }, inAyah: ['الحق', 'المبين'] }],
    hadith: [{ collection: 'bukhari', phrase: 'أنت الحق ووعدك الحق', number: 1120 }],
    livingAr: ['وعد الله حق، فلا تستبطئ نصره ولا ثوابه.'],
    keyPointsAr: ['الله الحق، وكل ما سواه زائل.'],
  },
  {
    id: 'ism-wali-mawla', names: ['الولي', 'المولى', 'النصير'], titleEn: 'Al-Waliyy, Al-Mawla, An-Nasir',
    meaningAr: ['الولي المولى: الذي يتولّى أمور عباده المؤمنين ويحبهم وينصرهم. النصير: الذي ينصر من نصره.'],
    quran: [{ ref: { surah: 8, from: 40 }, inAyah: ['المولى', 'النصير'] }, { ref: { surah: 42, from: 28 }, inAyah: ['الولي', 'الحميد'] }],
    livingAr: ['من كان الله وليّه فلن يضيع، فاجعل ولاءك لله ولرسوله وللمؤمنين.'],
    keyPointsAr: ['«نعم المولى ونعم النصير».'],
  },
  {
    id: 'ism-barr-majid', names: ['البر', 'المجيد'], titleEn: 'Al-Barr, Al-Majid',
    meaningAr: ['البر: الواسع الإحسان إلى عباده. المجيد: الواسع المجد والشرف والكرم.'],
    quran: [{ ref: { surah: 52, from: 28 }, inAyah: ['البر', 'الرحيم'] }, { ref: { surah: 11, from: 73 }, inAyah: ['حميد', 'مجيد'] }],
    livingAr: ['من عرف أن ربه بَرّ رحيم أحسن الظن به في كل حال.'],
    keyPointsAr: ['نقول في التشهد: «إنك حميد مجيد».'],
  },
  {
    id: 'ism-tayyib-jamil-rafiq', names: ['الطيب', 'الجميل', 'الرفيق'], titleEn: 'At-Tayyib, Al-Jamil, Ar-Rafiq',
    meaningAr: [
      'ثبتت هذه الأسماء في السنة الصحيحة: «إن الله طيب لا يقبل إلا طيبًا»، «إن الله جميل يحب الجمال»، «إن الله رفيق يحب الرفق في الأمر كله».',
    ],
    quran: [],
    hadith: [
      { collection: 'muslim', phrase: 'إن الله طيب لا يقبل إلا طيبا', number: 1015 },
      { collection: 'muslim', phrase: 'إن الله جميل يحب الجمال', number: 91 },
      { collection: 'bukhari', phrase: 'إن الله رفيق يحب الرفق في الأمر كله', number: 6927 },
    ],
    livingAr: ['تحرَّ الحلال الطيب في كسبك، واعتنِ بجمال مظهرك وأخلاقك، وارفق بأهلك ومن حولك.'],
    keyPointsAr: ['من أسماء الله ما ثبت في السنة الصحيحة.'],
  },
];

/** For tests: every ayah cited for a name must contain the listed words. */
export const ASMA_REFS = NAMES.flatMap(n => n.quran.map(q => ({ id: n.id, surah: q.ref.surah, ayah: q.ref.from, words: q.inAyah })));

export const ASMA_HUSNA: ItemDef[] = [
  {
    id: 'asma-intro',
    order: 1,
    titleAr: 'ولله الأسماء الحسنى',
    titleEn: 'To Allah belong the most beautiful names',
    summaryAr: 'لله تسعة وتسعون اسمًا، من أحصاها دخل الجنة. وإحصاؤها: حفظها، وفهم معانيها، والعمل بمقتضاها، ودعاء الله بها.',
    sections: [
      {
        titleAr: 'فادعوه بها',
        paragraphsAr: [
          'قال الله: «ولله الأسماء الحسنى فادعوه بها». وقال النبي ﷺ: «إن لله تسعة وتسعين اسمًا، مائة إلا واحدًا، من أحصاها دخل الجنة».',
          'والقائمة المشهورة بتسعة وتسعين اسمًا لم ترد في الصحيحين، ولذلك جمعنا في هذا القسم الأسماء الواردة في القرآن الكريم وفي الأحاديث الصحيحة، كل اسم مع الآية التي ورد فيها.',
        ],
        quran: [{ surah: 7, from: 180 }],
        hadith: [{ collection: 'bukhari', phrase: 'إن لله تسعة وتسعين اسما مائة إلا واحدا من أحصاها دخل الجنة', number: 2736 }],
      },
      {
        titleAr: 'كيف نُحصيها؟',
        paragraphsAr: [
          'الإحصاء ليس حفظ القائمة فقط، بل: أن تعرف الاسم، وتفهم معناه، وتدعو الله به («يا رزاق ارزقني»، «يا تواب تب عليّ»)، وأن يظهر أثره في قلبك وسلوكك.',
        ],
        reflectionAr: 'في كل اسم من الأسماء التالية فقرة «أثره في حياتك»: هي الطريق العملي للإحصاء.',
        quran: [{ surah: 59, from: 24 }],
      },
    ],
    keyPointsAr: ['لله تسعة وتسعون اسمًا من أحصاها دخل الجنة.', 'الإحصاء: الفهم والدعاء والعمل.'],
    quiz: [
      { questionAr: 'ما جزاء من أحصى أسماء الله الحسنى؟', optionsAr: ['دخل الجنة', 'غُفر له يومه', 'لا يمرض'], correctIndex: 0, explanationAr: 'صحيح البخاري ٢٧٣٦.' },
      { questionAr: 'ماذا أمرنا الله أن نفعل بأسمائه؟', optionsAr: ['أن ندعوه بها', 'أن نكتبها فقط', 'أن نعلّقها'], correctIndex: 0, explanationAr: 'الأعراف ١٨٠.' },
    ],
    review: DRAFT,
  },
  ...NAMES.map((n, i): ItemDef => ({
    id: n.id,
    order: (i + 1) * 10,
    titleAr: n.names.join('، '),
    titleEn: n.titleEn,
    summaryAr: n.meaningAr[0]!.length > 220 ? `${n.meaningAr[0]!.slice(0, n.meaningAr[0]!.lastIndexOf(' ', 200))}…` : n.meaningAr[0]!,
    sections: [
      { titleAr: 'المعنى', paragraphsAr: n.meaningAr, quran: n.quran.map(q => q.ref), hadith: n.hadith ?? [] },
      { titleAr: 'أثره في حياتك', paragraphsAr: n.livingAr, quran: n.quran.slice(0, 1).map(q => q.ref), hadith: n.quran.length === 0 ? (n.hadith ?? []).slice(0, 1) : [] },
    ],
    keyPointsAr: n.keyPointsAr,
    quiz: [],
    review: DRAFT,
  })),
];

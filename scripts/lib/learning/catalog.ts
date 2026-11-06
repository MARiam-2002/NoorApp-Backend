/**
 * Learning hub catalog («تعلّم مع نور»). Sections that already exist in Noor point to their own endpoint
 * (companions = figures of the day, morals = stances), so nothing is duplicated.
 */
import type { CollectionDef, ItemDef } from './types';
import { PROPHET_STORIES } from './prophet-stories';
import { PROPHET_STORIES_BATCH_2 } from './prophet-stories-2';
import { PROPHET_STORIES_BATCH_3 } from './prophet-stories-3';
import { FIQH_FASTING } from './fiqh-fasting';
import { AQEEDAH } from './aqeedah';
import { ASMA_HUSNA } from './asma-husna';
import { TAJWEED } from './tajweed';
import { SEERAH } from './seerah';

/** Titles for the 42 hadith of al-Arba'in an-Nawawiyyah. The hadith text itself is copied verbatim by the build. */
export const NAWAWI_TITLES: string[] = [
  'إنما الأعمال بالنيات', 'الإسلام والإيمان والإحسان (حديث جبريل)', 'أركان الإسلام', 'خلق الإنسان والقدر', 'النهي عن الإحداث في الدين',
  'الحلال بيّن والحرام بيّن', 'الدين النصيحة', 'حرمة دم المسلم وماله', 'ما نهيتكم عنه فاجتنبوه', 'إن الله طيب لا يقبل إلا طيبًا',
  'دع ما يريبك إلى ما لا يريبك', 'من حسن إسلام المرء تركه ما لا يعنيه', 'يحب لأخيه ما يحب لنفسه', 'لا يحل دم امرئ مسلم إلا بإحدى ثلاث', 'فليقل خيرًا أو ليصمت',
  'لا تغضب', 'إن الله كتب الإحسان على كل شيء', 'اتق الله حيثما كنت', 'احفظ الله يحفظك', 'إذا لم تستحِ فاصنع ما شئت',
  'قل آمنت بالله ثم استقم', 'الطريق إلى الجنة بالفرائض', 'الطهور شطر الإيمان', 'يا عبادي إني حرمت الظلم على نفسي', 'ذهب أهل الدثور بالأجور',
  'كل سلامى من الناس عليه صدقة', 'البر حسن الخلق', 'عليكم بسنتي ولزوم الجماعة', 'رأس الأمر وعموده وذروة سنامه', 'إن الله فرض فرائض فلا تضيعوها',
  'ازهد في الدنيا يحبك الله', 'لا ضرر ولا ضرار', 'البينة على المدعي', 'من رأى منكم منكرًا فليغيره', 'لا تحاسدوا… وكونوا عباد الله إخوانًا',
  'من نفّس عن مؤمن كربة', 'إن الله كتب الحسنات والسيئات', 'من عادى لي وليًّا', 'إن الله تجاوز لي عن أمتي الخطأ والنسيان', 'كن في الدنيا كأنك غريب',
  'لا يؤمن أحدكم حتى يكون هواه تبعًا لما جئت به', 'يا ابن آدم إنك ما دعوتني ورجوتني',
];

const arabicDigits = (n: number) => String(n).replace(/[0-9]/g, d => String.fromCharCode(0x0660 + Number(d)));

const nawawiItems: ItemDef[] = NAWAWI_TITLES.map((titleAr, i) => ({
  id: `nawawi-${i + 1}`,
  order: i + 1,
  titleAr,
  titleEn: `An-Nawawi's Forty, hadith ${i + 1}`,
  summaryAr: `الحديث ${arabicDigits(i + 1)} من الأربعين النووية.`,
  sections: [{ titleAr: 'نص الحديث', paragraphsAr: [], nawawi: [i + 1] }],
  keyPointsAr: [],
  quiz: [],
  review: { status: 'DRAFT' },
}));

export const LEARNING_CATALOG_VERSION = 4;

export const LEARNING_COLLECTIONS: CollectionDef[] = [
  {
    id: 'prophet-stories', order: 1, kind: 'STORY', titleAr: 'قصص الأنبياء', titleEn: 'Stories of the Prophets',
    descriptionAr: 'قصص الأنبياء كما وردت في القرآن الكريم وصحيحي البخاري ومسلم، مع وقفات ودروس.',
    methodAr: 'كل قسم في القصة يذكر آياته وأحاديثه. الآيات منقولة بنصها من المصحف، والأحاديث من صحيحي البخاري ومسلم بنصها ورقمها. لا إسرائيليات ولا أسماء أو تفاصيل لم ترد في هذه المصادر. يمكنك فتح تفسير أي آية من زر التفسير.',
    items: [...PROPHET_STORIES, ...PROPHET_STORIES_BATCH_2, ...PROPHET_STORIES_BATCH_3],
  },
  {
    id: 'seerah', order: 2, kind: 'STORY', titleAr: 'السيرة النبوية', titleEn: 'The Prophetic Biography',
    descriptionAr: 'سيرة النبي ﷺ من مولده إلى وفاته، وأخلاقه، من القرآن والأحاديث الصحيحة.',
    methodAr: 'كل فصل من القرآن الكريم وصحيحي البخاري ومسلم بنص الحديث ورقمه. التفاصيل المشهورة التي لم ترد في هذه المصادر (تواريخ وأسماء وأعداد) تُركت عمدًا.',
    items: SEERAH,
  },
  {
    id: 'companions', order: 3, kind: 'STORY', existingEndpoint: '/content/figures', titleAr: 'قصص الصحابة', titleEn: 'Stories of the Companions',
    descriptionAr: 'قصص الصحابة والصحابيات من صحيحي البخاري ومسلم (قسم «شخصية اليوم»).',
    methodAr: 'كل قصة مبنية على روايات من صحيحي البخاري ومسلم مع نصها ورقمها.',
    items: [],
  },
  {
    id: 'aqeedah', order: 4, kind: 'LESSON', titleAr: 'العقيدة', titleEn: 'Creed',
    descriptionAr: 'أركان الإيمان وأركان الإسلام بأدلتها.',
    methodAr: 'أدلة كل درس من القرآن الكريم وصحيحي البخاري ومسلم، دون الدخول في مسائل الخلاف.',
    items: AQEEDAH,
  },
  {
    id: 'asma-husna', order: 5, kind: 'LESSON', titleAr: 'أسماء الله الحسنى', titleEn: 'The Beautiful Names of Allah',
    descriptionAr: 'كل اسم مع الآية التي ورد فيها ومعناه.',
    methodAr: 'الأسماء الواردة في القرآن الكريم مع الآية التي ورد فيها كل اسم، وما ثبت في الصحيحين. القائمة المشهورة بتسعة وتسعين اسمًا لم ترد في الصحيحين، فلم نعتمد عليها.',
    items: ASMA_HUSNA,
  },
  {
    id: 'fiqh', order: 6, kind: 'LESSON', titleAr: 'الفقه', titleEn: 'Fiqh',
    descriptionAr: 'أحكام العبادات بأدلتها، بدءًا بفقه الصيام.',
    methodAr: 'كل حكم مع دليله: الآيات بنصها من المصحف، والأحاديث من صحيحي البخاري ومسلم بنصها ورقمها. ما اتفق عليه العلماء يُذكر حكمًا، وما اختلفوا فيه يُذكر الخلاف باختصار مع رأي دار الإفتاء المصرية. ليس بديلًا عن سؤال أهل العلم في حالتك الخاصة.',
    items: FIQH_FASTING,
  },
  {
    id: 'tajweed', order: 7, kind: 'LESSON', titleAr: 'دروس التجويد', titleEn: 'Tajweed lessons',
    descriptionAr: 'أحكام التجويد على منهج تحفة الأطفال ثم الجزرية، بأمثلة من المصحف.',
    methodAr: 'على منهج متن تحفة الأطفال للجمزوري برواية حفص عن عاصم، وكل مثال كلمة من آية منقولة بنصها من المصحف، يمكنك الاستماع إليها. التجويد يُتلقّى بالمشافهة، فاجعل هذه الدروس عونًا مع معلّم.',
    items: TAJWEED,
  },
  {
    id: 'nawawi-forty', order: 8, kind: 'HADITH', titleAr: 'الأربعون النووية', titleEn: "An-Nawawi's Forty Hadith",
    descriptionAr: 'اثنان وأربعون حديثًا جمعها الإمام النووي من جوامع الدين.',
    methodAr: 'نص كل حديث منقول كما أورده الإمام النووي، مع تخريجه وحكمه كما ذكرهما.',
    items: nawawiItems,
  },
  {
    id: 'morals', order: 9, kind: 'LESSON', existingEndpoint: '/stances/catalog', titleAr: 'الأخلاق والمواقف', titleEn: 'Character and situations',
    descriptionAr: 'مواقف يومية وما يرشد إليه الإسلام فيها (قسم «موقفك إيه؟»).',
    methodAr: 'كل موقف مع دليله من القرآن والسنة الصحيحة.',
    items: [],
  },
];

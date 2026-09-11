/**
 * Curated authentic Hadith bank for Hadith-of-the-Day.
 * Texts are well-known narrations with classical source labels
 * (Bukhari / Muslim / Tirmidhi / Abu Dawud). Used for:
 * 1) prisma seed → HadithOfTheDay rows (dayOfYear 1..366)
 * 2) Runtime fallback when a day row is missing (rotates by dayOfYear)
 *
 * Do not invent or AI-generate Hadith content here.
 */

export type CuratedHadith = {
  textAr: string;
  sourceAr: string;
};

export const CURATED_HADITHS: CuratedHadith[] = [
  { textAr: 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'من حسن إسلام المرء تركه ما لا يعنيه', sourceAr: 'رواه الترمذي' },
  { textAr: 'لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'الدين النصيحة', sourceAr: 'رواه مسلم' },
  { textAr: 'من كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليصمت', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'المسلم من سلم المسلمون من لسانه ويده', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'أحب الأعمال إلى الله أدومها وإن قل', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'الصدقة تطفئ الخطيئة كما يطفئ الماء النار', sourceAr: 'رواه الترمذي' },
  {
    textAr:
      'إذا مات ابن آدم انقطع عمله إلا من ثلاث: صدقة جارية، أو علم ينتفع به، أو ولد صالح يدعو له',
    sourceAr: 'رواه مسلم',
  },
  { textAr: 'من سلك طريقا يلتمس فيه علما سهل الله له به طريقا إلى الجنة', sourceAr: 'رواه مسلم' },
  {
    textAr: 'اتق الله حيثما كنت، وأتبع السيئة الحسنة تمحها، وخالق الناس بخلق حسن',
    sourceAr: 'رواه الترمذي',
  },
  { textAr: 'لا تغضب', sourceAr: 'رواه البخاري' },
  { textAr: 'الطهور شطر الإيمان', sourceAr: 'رواه مسلم' },
  { textAr: 'من صلى علي صلاة صلى الله عليه بها عشرا', sourceAr: 'رواه مسلم' },
  { textAr: 'يسروا ولا تعسروا، وبشروا ولا تنفروا', sourceAr: 'رواه البخاري ومسلم' },
  {
    textAr: 'إن الله لا ينظر إلى صوركم وأموالكم، ولكن ينظر إلى قلوبكم وأعمالكم',
    sourceAr: 'رواه مسلم',
  },
  { textAr: 'من لا يرحم الناس لا يرحمه الله', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'المؤمن للمؤمن كالبنيان يشد بعضه بعضا', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'من غشنا فليس منا', sourceAr: 'رواه مسلم' },
  { textAr: 'خيركم من تعلم القرآن وعلمه', sourceAr: 'رواه البخاري' },
  { textAr: 'اقرأوا القرآن فإنه يأتي يوم القيامة شفيعا لأصحابه', sourceAr: 'رواه مسلم' },
  { textAr: 'مثل الذي يذكر ربه والذي لا يذكر ربه مثل الحي والميت', sourceAr: 'رواه البخاري' },
  {
    textAr:
      'كلمتان خفيفتان على اللسان، ثقيلتان في الميزان، حبيبتان إلى الرحمن: سبحان الله وبحمده، سبحان الله العظيم',
    sourceAr: 'رواه البخاري ومسلم',
  },
  {
    textAr: 'من قال سبحان الله وبحمده في يوم مائة مرة حطت خطاياه وإن كانت مثل زبد البحر',
    sourceAr: 'رواه البخاري ومسلم',
  },
  {
    textAr: 'الراحمون يرحمهم الرحمن، ارحموا من في الأرض يرحمكم من في السماء',
    sourceAr: 'رواه الترمذي وأبو داود',
  },
  {
    textAr: 'ليس الشديد بالصرعة، إنما الشديد الذي يملك نفسه عند الغضب',
    sourceAr: 'رواه البخاري ومسلم',
  },
  { textAr: 'من كان يؤمن بالله واليوم الآخر فليكرم جاره', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'تبسمك في وجه أخيك صدقة', sourceAr: 'رواه الترمذي' },
  { textAr: 'الحياء من الإيمان', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'من يرد الله به خيرا يفقهه في الدين', sourceAr: 'رواه البخاري ومسلم' },
];

export function getCuratedHadithForDay(dayOfYear: number): CuratedHadith {
  const idx =
    ((Math.floor(dayOfYear) - 1) % CURATED_HADITHS.length + CURATED_HADITHS.length) %
    CURATED_HADITHS.length;
  return CURATED_HADITHS[idx]!;
}

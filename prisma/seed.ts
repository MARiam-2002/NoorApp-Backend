import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, RevelationType } from '@prisma/client';

const prisma = new PrismaClient();

const QURAN_API_BASE = 'https://api.alquran.cloud/v1';
const DATA_DIR = join(process.cwd(), 'prisma', 'data');
const QURAN_CACHE = join(DATA_DIR, 'quran-uthmani.json');
const SURAHS_CACHE = join(DATA_DIR, 'surahs.json');

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

const VERSE_REFS: { surahNumber: number; ayahNumber: number }[] = [
  { surahNumber: 2, ayahNumber: 255 },
  { surahNumber: 1, ayahNumber: 7 },
  { surahNumber: 94, ayahNumber: 6 },
  { surahNumber: 65, ayahNumber: 3 },
  { surahNumber: 2, ayahNumber: 286 },
  { surahNumber: 9, ayahNumber: 103 },
  { surahNumber: 13, ayahNumber: 28 },
  { surahNumber: 55, ayahNumber: 13 },
  { surahNumber: 20, ayahNumber: 14 },
  { surahNumber: 3, ayahNumber: 159 },
  { surahNumber: 18, ayahNumber: 109 },
  { surahNumber: 36, ayahNumber: 82 },
  { surahNumber: 59, ayahNumber: 23 },
  { surahNumber: 67, ayahNumber: 2 },
  { surahNumber: 112, ayahNumber: 1 },
  { surahNumber: 103, ayahNumber: 1 },
  { surahNumber: 2, ayahNumber: 153 },
  { surahNumber: 8, ayahNumber: 46 },
  { surahNumber: 4, ayahNumber: 59 },
  { surahNumber: 2, ayahNumber: 269 },
  { surahNumber: 17, ayahNumber: 82 },
  { surahNumber: 29, ayahNumber: 69 },
  { surahNumber: 92, ayahNumber: 5 },
  { surahNumber: 81, ayahNumber: 29 },
  { surahNumber: 24, ayahNumber: 35 },
  { surahNumber: 3, ayahNumber: 134 },
  { surahNumber: 2, ayahNumber: 43 },
  { surahNumber: 98, ayahNumber: 7 },
  { surahNumber: 22, ayahNumber: 40 },
  { surahNumber: 2, ayahNumber: 186 },
  { surahNumber: 99, ayahNumber: 7 },
  { surahNumber: 91, ayahNumber: 9 },
  { surahNumber: 7, ayahNumber: 199 },
  { surahNumber: 49, ayahNumber: 13 },
  { surahNumber: 16, ayahNumber: 97 },
  { surahNumber: 39, ayahNumber: 53 },
  { surahNumber: 41, ayahNumber: 30 },
  { surahNumber: 48, ayahNumber: 29 },
  { surahNumber: 57, ayahNumber: 21 },
  { surahNumber: 64, ayahNumber: 11 },
];

const HADITHS: { textAr: string; sourceAr: string }[] = [
  { textAr: 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'من حسن إسلام المرء تركه ما لا يعنيه', sourceAr: 'رواه الترمذي' },
  { textAr: 'لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'الدين النصيحة', sourceAr: 'رواه مسلم' },
  { textAr: 'من كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليصمت', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'المسلم من سلم المسلمون من لسانه ويده', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'أحب الأعمال إلى الله أدومها وإن قل', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'الصدقة تطفئ الخطيئة كما يطفئ الماء النار', sourceAr: 'رواه الترمذي' },
  { textAr: 'إذا مات ابن آدم انقطع عمله إلا من ثلاث: صدقة جارية، أو علم ينتفع به، أو ولد صالح يدعو له', sourceAr: 'رواه مسلم' },
  { textAr: 'من سلك طريقا يلتمس فيه علما سهل الله له به طريقا إلى الجنة', sourceAr: 'رواه مسلم' },
  { textAr: 'اتق الله حيثما كنت، وأتبع السيئة الحسنة تمحها، وخالق الناس بخلق حسن', sourceAr: 'رواه الترمذي' },
  { textAr: 'لا تغضب', sourceAr: 'رواه البخاري' },
  { textAr: 'الطهور شطر الإيمان', sourceAr: 'رواه مسلم' },
  { textAr: 'من صلى علي صلاة صلى الله عليه بها عشرا', sourceAr: 'رواه مسلم' },
  { textAr: 'يسروا ولا تعسروا، وبشروا ولا تنفروا', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'إن الله لا ينظر إلى صوركم وأموالكم، ولكن ينظر إلى قلوبكم وأعمالكم', sourceAr: 'رواه مسلم' },
  { textAr: 'من لا يرحم الناس لا يرحمه الله', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'المؤمن للمؤمن كالبنيان يشد بعضه بعضا', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'من غشنا فليس منا', sourceAr: 'رواه مسلم' },
  { textAr: 'خيركم من تعلم القرآن وعلمه', sourceAr: 'رواه البخاري' },
  { textAr: 'اقرأوا القرآن فإنه يأتي يوم القيامة شفيعا لأصحابه', sourceAr: 'رواه مسلم' },
  { textAr: 'مثل الذي يذكر ربه والذي لا يذكر ربه مثل الحي والميت', sourceAr: 'رواه البخاري' },
  { textAr: 'كلمتان خفيفتان على اللسان، ثقيلتان في الميزان، حبيبتان إلى الرحمن: سبحان الله وبحمده، سبحان الله العظيم', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'من قال سبحان الله وبحمده في يوم مائة مرة حطت خطاياه وإن كانت مثل زبد البحر', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'الراحمون يرحمهم الرحمن، ارحموا من في الأرض يرحمكم من في السماء', sourceAr: 'رواه الترمذي وأبو داود' },
  { textAr: 'ليس الشديد بالصرعة، إنما الشديد الذي يملك نفسه عند الغضب', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'من كان يؤمن بالله واليوم الآخر فليكرم جاره', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'تبسمك في وجه أخيك صدقة', sourceAr: 'رواه الترمذي' },
  { textAr: 'الحياء من الإيمان', sourceAr: 'رواه البخاري ومسلم' },
  { textAr: 'من يرد الله به خيرا يفقهه في الدين', sourceAr: 'رواه البخاري ومسلم' },
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

function revelationOf(raw?: string): RevelationType {
  return raw?.toLowerCase().startsWith('mec') ? RevelationType.MAKKI : RevelationType.MADANI;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(path, JSON.stringify(data));
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

interface QuranSurah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation?: string;
  numberOfAyahs: number;
  revelationType?: string;
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

interface CachedQuran {
  surahs: Array<{
    number: number;
    name: string;
    englishName: string;
    revelationType?: string;
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
}

function flattenAyahs(payload: CachedQuran): QuranAyah[] {
  const ayahs: QuranAyah[] = [];
  for (const s of payload.surahs) {
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

async function loadSurahs(): Promise<QuranSurah[]> {
  const cached = readJson<QuranSurah[]>(SURAHS_CACHE);
  if (cached?.length === 114) {
    console.log('📦 Using cached surahs from prisma/data/surahs.json');
    return cached;
  }

  const res = await fetch(`${QURAN_API_BASE}/surah`);
  if (!res.ok) {
    throw new Error(`Failed to fetch surahs: HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data: QuranSurah[] };
  writeJson(SURAHS_CACHE, json.data);
  console.log('💾 Saved surahs to prisma/data/surahs.json (alquran.cloud / Tanzil Uthmani)');
  return json.data;
}

async function loadAyahs(): Promise<QuranAyah[]> {
  const cached = readJson<{ data?: CachedQuran } & CachedQuran>(QURAN_CACHE);
  const payload = cached?.data ?? (cached?.surahs ? cached : null);
  if (payload?.surahs?.length === 114) {
    console.log('📦 Using cached mushaf from prisma/data/quran-uthmani.json');
    return flattenAyahs(payload);
  }

  const res = await fetch(`${QURAN_API_BASE}/quran/quran-uthmani`);
  if (!res.ok) {
    throw new Error(`Failed to fetch mushaf: HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data: CachedQuran };
  writeJson(QURAN_CACHE, json.data);
  console.log('💾 Saved mushaf to prisma/data/quran-uthmani.json (alquran.cloud / Tanzil)');
  return flattenAyahs(json.data);
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
        revelationType: revelationOf(s.revelationType),
      },
      update: {
        nameAr: cleanName,
        nameEn: s.englishName,
        totalAyahs: s.numberOfAyahs,
        totalPages,
        revelationType: revelationOf(s.revelationType),
      },
    });
  }
}

async function upsertAyahs(ayahs: QuranAyah[]): Promise<void> {
  const BATCH = 100;
  for (let i = 0; i < ayahs.length; i += BATCH) {
    const batch = ayahs.slice(i, i + BATCH);
    const tasks = batch.map((a) =>
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
  const ayahs = await prisma.ayah.findMany({
    select: {
      surahId: true,
      ayahNumber: true,
      textAr: true,
      surah: { select: { nameAr: true } },
    },
  });
  const map = new Map(ayahs.map((a) => [`${a.surahId}:${a.ayahNumber}`, a]));

  for (let day = 1; day <= 366; day += 1) {
    const ref = VERSE_REFS[(day - 1) % VERSE_REFS.length];
    const ayah = map.get(`${ref.surahNumber}:${ref.ayahNumber}`);
    if (!ayah) continue;

    await prisma.verseOfTheDay.upsert({
      where: { dayOfYear: day },
      create: {
        dayOfYear: day,
        surahNumber: ayah.surahId,
        ayahNumber: ayah.ayahNumber,
        textAr: ayah.textAr,
        referenceAr: `سورة ${ayah.surah.nameAr} — آية ${ayah.ayahNumber}`,
      },
      update: {
        surahNumber: ayah.surahId,
        ayahNumber: ayah.ayahNumber,
        textAr: ayah.textAr,
        referenceAr: `سورة ${ayah.surah.nameAr} — آية ${ayah.ayahNumber}`,
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
  console.log('Starting seed for Noor App...');
  console.log('Source: alquran.cloud (Tanzil Uthmani), cached under prisma/data/');

  const surahs = await loadSurahs();
  const ayahs = await loadAyahs();

  console.log(`Loaded ${surahs.length} surahs and ${ayahs.length} ayahs`);

  console.log('Upserting surahs...');
  await upsertSurahs(surahs);

  console.log('Upserting ayahs with page/juz...');
  await upsertAyahs(ayahs);

  console.log('Upserting 366 verses of the day from mushaf text...');
  await upsertVersesOfDay();

  console.log('Upserting 366 hadiths of the day...');
  await upsertHadiths();

  console.log('Upserting 366 daily challenges...');
  await upsertChallenges();

  console.log('SEED COMPLETE');
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

main()
  .catch((error: unknown) => {
    console.error('SEED FAILED:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

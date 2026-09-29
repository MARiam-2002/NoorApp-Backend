/**
 * Source attribution shown in the app's "Sources / About" screen.
 * Tanzil's text license requires naming Tanzil and linking to tanzil.net wherever its text is used.
 */
export type ContentCredit = {
  key: string;
  titleAr: string;
  titleEn: string;
  sourceAr: string;
  sourceEn: string;
  url: string;
  noteAr: string | null;
  noteEn: string | null;
};

export const CONTENT_CREDITS_VERSION = 2;

export const CONTENT_CREDITS: readonly ContentCredit[] = [
  {
    key: 'quran_text',
    titleAr: 'نص القرآن الكريم',
    titleEn: 'Quran text',
    sourceAr: 'مشروع تنزيل (Tanzil) — الرسم العثماني',
    sourceEn: 'Tanzil Project — Uthmani script',
    url: 'https://tanzil.net',
    noteAr: 'النص منقول حرفيًا دون أي تعديل.',
    noteEn: 'Reproduced verbatim without any modification.',
  },
  {
    key: 'tafsir_translations',
    titleAr: 'التفاسير والترجمات',
    titleEn: 'Tafsir and translations',
    sourceAr: 'مؤسسة القرآن (Quran Foundation)',
    sourceEn: 'Quran Foundation',
    url: 'https://quran.foundation',
    noteAr: null,
    noteEn: null,
  },
  {
    key: 'tafsir_qurtubi',
    titleAr: 'تفسير القرطبي',
    titleEn: 'Tafsir Al-Qurtubi',
    sourceAr: 'المكتبة القرآنية الشاملة (QUL) — ترتيل',
    sourceEn: 'Quranic Universal Library (QUL) — Tarteel',
    url: 'https://qul.tarteel.ai',
    noteAr: null,
    noteEn: null,
  },
  {
    key: 'hadith',
    titleAr: 'حديث اليوم',
    titleEn: 'Hadith of the Day',
    sourceAr: 'صحيح البخاري وصحيح مسلم — نصوص مشروع Hadith API',
    sourceEn: 'Sahih al-Bukhari and Sahih Muslim — Hadith API project texts',
    url: 'https://github.com/fawazahmed0/hadith-api',
    noteAr: 'ترقيم البخاري حسب فتح الباري، وترقيم مسلم حسب محمد فؤاد عبد الباقي.',
    noteEn: 'Bukhari numbered per Fath al-Bari; Muslim per Muhammad Fuad Abd al-Baqi.',
  },
  {
    key: 'figures',
    titleAr: 'شخصية اليوم',
    titleEn: 'Figure of the Day',
    sourceAr: 'السِّيَر من «الإصابة في تمييز الصحابة» لابن حجر و«سير أعلام النبلاء» للذهبي؛ والشواهد من الصحيحين',
    sourceEn: "Biographies per Ibn Hajar's al-Isabah and al-Dhahabi's Siyar A'lam al-Nubala; evidence from the two Sahihs",
    url: 'https://github.com/fawazahmed0/hadith-api',
    noteAr: 'كل شاهد منقول حرفيًا من صحيح البخاري أو صحيح مسلم مع رقمه.',
    noteEn: 'Every evidence excerpt is quoted verbatim from Sahih al-Bukhari or Sahih Muslim with its number.',
  },
];

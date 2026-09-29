import { Router } from 'express';
import {
  getDailyChallengeHandler,
  getFigureByIdHandler,
  getFigureOfDayHandler,
  getHadithOfDayHandler,
  getVerseOfDayHandler,
  listFiguresHandler,
} from '../controllers/content.controller';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { getStaticContentManifest } from '../services/content-static.service';
import { CONTENT_CREDITS, CONTENT_CREDITS_VERSION } from '../shared/constants/content-credits';

export const contentRouter = Router();

/**
 * @openapi
 * /content/verse-of-day:
 *   get:
 *     tags: ['Content']
 *     summary: آية اليوم
 *     description: آية القرآن التي تظهر في بطاقة "آية اليوم" بالشاشة الرئيسية.
 *     parameters:
 *       - in: query
 *         name: day
 *         schema: { type: integer, example: 208 }
 *         description: رقم اليوم في السنة (اختياري، افتراضي اليوم الحالي)
 *     responses:
 *       200:
 *         description: ✅ آية اليوم
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: آية اليوم
 *               data:
 *                 dayOfYear: 208
 *                 surahNumber: 2
 *                 surahNameAr: البقرة
 *                 surahNameEn: Al-Baqarah
 *                 verseNumber: 255
 *                 text: اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ
 *                 translation: الله - لا إله إلا هو، الحي القيوم. لا تأخذه سنة ولا نوم. له ما في السماوات وما في الأرض
 *                 audioUrl: https://cdn.noor.app/quran/2/255.mp3
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 */
contentRouter.get('/verse-of-day', getVerseOfDayHandler);

/**
 * @openapi
 * /content/hadith-of-day:
 *   get:
 *     tags: ['Content']
 *     summary: حديث اليوم
 *     description: بيانات بطاقة "حديث اليوم" في الشاشة الرئيسية.
 *     parameters:
 *       - in: query
 *         name: day
 *         schema: { type: integer, example: 208 }
 *         description: رقم اليوم في السنة (اختياري، افتراضي اليوم الحالي)
 *     responses:
 *       200:
 *         description: ✅ حديث اليوم
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: حديث اليوم
 *               data:
 *                 dayOfYear: 208
 *                 narrator: عن أبي هريرة رضي الله عنه
 *                 text: من سلك طريقاً يلتمس فيه علماً سهّل الله له به طريقاً إلى الجنة، وإن الملائكة لتضع أجنحتها لطالب العلم رضا بما يصنع
 *                 source: صحيح مسلم
 *                 grade: صحيح
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 */
contentRouter.get('/hadith-of-day', getHadithOfDayHandler);

/**
 * @openapi
 * /content/daily-challenge:
 *   get:
 *     tags: ['Content']
 *     summary: قالب التحدي اليومي (بدون حالة المستخدم)
 *     description: تفاصيل التحدي فقط (للتواصل مع /challenges/today للحالة الشخصية).
 *     parameters:
 *       - in: query
 *         name: day
 *         schema: { type: integer, example: 208 }
 *         description: رقم اليوم في السنة (اختياري، افتراضي اليوم الحالي)
 *     responses:
 *       200:
 *         description: ✅ تفاصيل التحدي
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تفاصيل التحدي اليومي
 *               data:
 *                 dayOfYear: 208
 *                 titleAr: اقرأ صفحتين من القرآن
 *                 descriptionAr: اقرأ صفحتين على الأقل من القرآن الكريم اليوم
 *                 type: QURAN_PAGES
 *                 target: 2
 *                 rewardPoints: 50
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 */
contentRouter.get('/daily-challenge', getDailyChallengeHandler);

/**
 * @openapi
 * /content/figure-of-day:
 *   get:
 *     tags: ['Content']
 *     summary: شخصية اليوم
 *     description: |
 *       Public, static catalog (no DB). A companion of the Prophet ﷺ for the "شخصية اليوم" card and
 *       detail screen. Every figure has at least one narration quoted verbatim from Sahih al-Bukhari
 *       (Fath al-Bari numbering) or Sahih Muslim (Fuad Abd al-Baqi numbering); biographies follow
 *       al-Isabah (Ibn Hajar) and Siyar A'lam al-Nubala (al-Dhahabi). Rotates daily; every figure is
 *       shown once before any repeats.
 *     parameters:
 *       - in: query
 *         name: day
 *         schema: { type: integer, example: 272 }
 *         description: رقم اليوم في السنة (اختياري، افتراضي اليوم الحالي)
 *     responses:
 *       200:
 *         description: ✅ شخصية اليوم
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Figure of the day retrieved successfully
 *               data:
 *                 dayOfYear: 272
 *                 catalogVersion: 1
 *                 id: musab-ibn-umair
 *                 nameAr: مصعب بن عمير
 *                 nameEn: "Mus'ab ibn Umair"
 *                 honorificAr: رضي الله عنه
 *                 titleAr: أول سفير في الإسلام
 *                 titleEn: The first envoy of Islam
 *                 summaryAr: فتى قريش المنعَّم الذي ترك الترف من أجل الإسلام...
 *                 storyAr: ['نشأ مصعب بن عمير في مكة في نعمة وترف...', 'بعثه النبي ﷺ بعد بيعة العقبة الأولى إلى المدينة...']
 *                 lessonAr: الإيمان أغلى من كل متاع الدنيا، والدعوة بالحكمة ولين الخلق تفتح القلوب.
 *                 evidence:
 *                   - collection: bukhari
 *                     collectionAr: صحيح البخاري
 *                     number: 3924
 *                     textAr: أَوَّلُ مَنْ قَدِمَ عَلَيْنَا مُصْعَبُ بْنُ عُمَيْرٍ
 *                     sourceAr: رواه البخاري — رقم 3924
 *                 sources:
 *                   - titleAr: صحيح البخاري
 *                     authorAr: الإمام محمد بن إسماعيل البخاري
 *       400:
 *         description: day خارج النطاق 1..366
 */
contentRouter.get('/figure-of-day', getFigureOfDayHandler);

/**
 * @openapi
 * /content/figures:
 *   get:
 *     tags: ['Content']
 *     summary: قائمة الشخصيات (مختصرة)
 *     description: Public. Lite list of all figures (no story/evidence) plus catalogVersion for caching.
 *     responses:
 *       200:
 *         description: ✅ القائمة
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Figures retrieved successfully
 *               data:
 *                 catalogVersion: 1
 *                 total: 34
 *                 items:
 *                   - id: musab-ibn-umair
 *                     nameAr: مصعب بن عمير
 *                     nameEn: "Mus'ab ibn Umair"
 *                     honorificAr: رضي الله عنه
 *                     titleAr: أول سفير في الإسلام
 *                     titleEn: The first envoy of Islam
 *                     summaryAr: فتى قريش المنعَّم الذي ترك الترف من أجل الإسلام...
 */
contentRouter.get('/figures', listFiguresHandler);

/**
 * @openapi
 * /content/figures/{id}:
 *   get:
 *     tags: ['Content']
 *     summary: تفاصيل شخصية (نفس شكل figure-of-day بدون dayOfYear)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: musab-ibn-umair }
 *     responses:
 *       200:
 *         description: ✅ تفاصيل الشخصية
 *       404:
 *         description: Figure not found
 */
contentRouter.get('/figures/:id', getFigureByIdHandler);

/**
 * @openapi
 * /content/static-meta:
 *   get:
 *     tags: ['Content']
 *     summary: Lightweight static content versions (Quran + Adhkar) for offline sync
 *     description: |
 *       Public. Returns catalogVersion + contentHash + download paths for Quran and Adhkar.
 *       Flutter should call this when online and only download full catalogs when
 *       local version/hash differs. Does not return ayah/adhkar texts.
 *     responses:
 *       200:
 *         description: Static content manifest
 */
contentRouter.get(
  '/static-meta',
  asyncHandler(async (req, res) => {
    const data = await getStaticContentManifest();
    sendSuccess(res, data, 'Static content meta retrieved successfully', req);
  }),
);

/**
 * @openapi
 * /content/credits:
 *   get:
 *     tags: ['Content']
 *     summary: مصادر المحتوى وحقوقه (شاشة "المصادر")
 *     description: |
 *       Public, static. Attribution for Quran text (Tanzil — required by its license),
 *       tafsir/translations, and Hadith of the Day. Show each item's source + link.
 *     responses:
 *       200:
 *         description: ✅ قائمة المصادر
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Content credits retrieved successfully
 *               data:
 *                 version: 1
 *                 items:
 *                   - key: quran_text
 *                     titleAr: نص القرآن الكريم
 *                     titleEn: Quran text
 *                     sourceAr: مشروع تنزيل (Tanzil) — الرسم العثماني
 *                     sourceEn: Tanzil Project — Uthmani script
 *                     url: https://tanzil.net
 *                     noteAr: النص منقول حرفيًا دون أي تعديل.
 *                     noteEn: Reproduced verbatim without any modification.
 */
contentRouter.get('/credits', (req, res) => {
  sendSuccess(
    res,
    { version: CONTENT_CREDITS_VERSION, items: CONTENT_CREDITS },
    'Content credits retrieved successfully',
    req,
  );
});

import { Router } from 'express';
import {
  getDailyChallengeHandler,
  getHadithOfDayHandler,
  getVerseOfDayHandler,
} from '../controllers/content.controller';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { getStaticContentManifest } from '../services/content-static.service';

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

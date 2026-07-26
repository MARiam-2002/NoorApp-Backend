import { Router } from 'express';
import {
  getDailyChallengeHandler,
  getHadithOfDayHandler,
  getVerseOfDayHandler,
} from '../controllers/content.controller';

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
 *         schema: { type: integer, example: 200 }
 *         description: رقم اليوم في السنة (اختياري، افتراضي اليوم الحالي)
 *     responses:
 *       200: { description: ✅ آية اليوم }
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
 *         schema: { type: integer, example: 200 }
 *         description: رقم اليوم في السنة (اختياري، افتراضي اليوم الحالي)
 *     responses:
 *       200: { description: ✅ حديث اليوم }
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
 *         schema: { type: integer, example: 200 }
 *         description: رقم اليوم في السنة (اختياري، افتراضي اليوم الحالي)
 *     responses:
 *       200: { description: ✅ تفاصيل التحدي }
 */
contentRouter.get('/daily-challenge', getDailyChallengeHandler);

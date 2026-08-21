import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../lib/validation';
import {
  getProgress,
  getToday,
  incrementQuranPagesHandler,
  updateAdhkarHandler,
  updateQuranPagesHandler,
  updateSadaqahHandler,
} from '../controllers/journey.controller';

const quranPagesSetSchema = z.object({
  pages: z.coerce.number().int().min(0).max(604),
});

const quranPagesIncrementSchema = z.object({
  pages: z.coerce.number().int().min(1).max(604).default(1),
});

const adhkarSchema = z.object({
  completed: z.boolean(),
});

const sadaqahSchema = z.object({
  amount: z.coerce.number().min(0),
});

export const journeyRouter = Router();

/**
 * @openapi
 * /journey/today:
 *   get:
 *     tags: ['Journey']
 *     summary: تقدم اليوم في "رحلتي" (صفحات القرآن + الأذكار + الصدقات)
 *     description: بيانات بطاقات "رحلتك اليومية" اللي في شاشة الرئيسية.
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: ✅ تقدم اليوم
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تقدم اليوم في رحلتي
 *               data:
 *                 date: '2026-07-27'
 *                 quran:
 *                   pages: 3
 *                   goal: 4
 *                   percent: 75
 *                 adhkar:
 *                   morningCompleted: true
 *                   eveningCompleted: false
 *                   overallCompleted: false
 *                   percent: 50
 *                 sadaqah:
 *                   amount: 25
 *                   goal: 50
 *                   percent: 50
 *                   currency: EGP
 *                 prayers:
 *                   completed: 3
 *                   total: 5
 *                   percent: 60
 *                 overallPercent: 58.75
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
journeyRouter.get('/today', authenticate, getToday);

/**
 * @openapi
 * /journey/progress:
 *   get:
 *     tags: ['Journey']
 *     summary: تقدم الرحلة خلال عدد من الأيام الماضية
 *     description: إحصائيات رحلة المستخدم خلال الأيام الماضية (افتراضي 7 أيام) مع ملخص إجمالي.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 7, minimum: 1, maximum: 365, example: 7 }
 *         description: عدد الأيام للرجوع للخلف
 *     responses:
 *       200:
 *         description: ✅ تقدم الرحلة
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تقدم الرحلة خلال آخر 7 أيام
 *               data:
 *                 periodDays: 7
 *                 summary:
 *                   totalQuranPages: 21
 *                   totalSadaqahAmount: 350
 *                   adhkarDaysCompleted: 5
 *                   prayersCompletedCount: 28
 *                   daysStreak: 7
 *                 daily:
 *                   - date: '2026-07-21'
 *                     quranPages: 2
 *                     sadaqah: 50
 *                     adhkarCompleted: true
 *                     prayersCompleted: 4
 *                     overallPercent: 80
 *                   - date: '2026-07-22'
 *                     quranPages: 4
 *                     sadaqah: 0
 *                     adhkarCompleted: false
 *                     prayersCompleted: 5
 *                     overallPercent: 55
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
journeyRouter.get('/progress', authenticate, getProgress);

/**
 * @openapi
 * /journey/quran-pages:
 *   patch:
 *     tags: ['Journey']
 *     summary: ضبط عدد صفحات القرآن المقروءة لليوم بقيمة محددة
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pages]
 *             properties:
 *               pages:
 *                 type: integer
 *                 example: 4
 *                 description: "الإجمالي الجديد للصفحات لليوم"
 *           examples:
 *             default:
 *               summary: ضبط العدد إلى 4 صفحات
 *               value:
 *                 pages: 4
 *     responses:
 *       200:
 *         description: ✅ تم التحديث
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم تحديث صفحات القرآن لليوم
 *               data:
 *                 date: '2026-07-27'
 *                 quranPages: 4
 *                 goal: 4
 *                 percent: 100
 *                 overallPercent: 65
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
journeyRouter.patch('/quran-pages', authenticate, validate(quranPagesSetSchema), updateQuranPagesHandler);

/**
 * @openapi
 * /journey/quran-pages/increment:
 *   post:
 *     tags: ['Journey']
 *     summary: زيادة عدد صفحات القرآن بمقدار (بعد قراءة مجموعة صفحات جديدة)
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pages]
 *             properties:
 *               pages:
 *                 type: integer
 *                 example: 2
 *                 description: "عدد الصفحات المقروءة الآن"
 *           examples:
 *             default:
 *               summary: زيادة بصفحتين
 *               value:
 *                 pages: 2
 *     responses:
 *       200:
 *         description: ✅ تمت الزيادة
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تمت زيادة صفحات القرآن بنجاح
 *               data:
 *                 date: '2026-07-27'
 *                 quranPages: 5
 *                 addedPages: 2
 *                 goal: 4
 *                 percent: 125
 *                 overallPercent: 68
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
journeyRouter.post(
  '/quran-pages/increment',
  authenticate,
  validate(quranPagesIncrementSchema),
  incrementQuranPagesHandler,
);

/**
 * @openapi
 * /journey/adhkar:
 *   patch:
 *     tags: ['Journey']
 *     summary: تبديل حالة إكمال أذكار اليوم
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [completed]
 *             properties:
 *               completed: { type: boolean, example: true }
 *           examples:
 *             default:
 *               summary: وضع علامة أن أذكار اليوم مكتملة
 *               value:
 *                 completed: true
 *     responses:
 *       200:
 *         description: ✅ تم التحديث
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم تحديث حالة الأذكار بنجاح
 *               data:
 *                 date: '2026-07-27'
 *                 morningCompleted: true
 *                 eveningCompleted: true
 *                 overallCompleted: true
 *                 percent: 100
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
journeyRouter.patch('/adhkar', authenticate, validate(adhkarSchema), updateAdhkarHandler);

/**
 * @openapi
 * /journey/sadaqah:
 *   patch:
 *     tags: ['Journey']
 *     summary: تحديث مبلغ الصدقة لليوم
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 50.0
 *                 description: "إجمالي الصدقة بالعملة المحلية"
 *           examples:
 *             default:
 *               summary: تسجيل 50 جنيه صدقة
 *               value:
 *                 amount: 50
 *     responses:
 *       200:
 *         description: ✅ تم التحديث
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم تحديث مبلغ الصدقة بنجاح
 *               data:
 *                 date: '2026-07-27'
 *                 amount: 50
 *                 goal: 50
 *                 percent: 100
 *                 currency: EGP
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
journeyRouter.patch('/sadaqah', authenticate, validate(sadaqahSchema), updateSadaqahHandler);

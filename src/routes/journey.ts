import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getProgress,
  getToday,
  incrementQuranPagesHandler,
  updateAdhkarHandler,
  updateQuranPagesHandler,
  updateSadaqahHandler,
} from '../controllers/journey.controller';

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
 *       200: { description: ✅ تقدم اليوم }
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
 *         schema: { type: integer, default: 7, minimum: 1, maximum: 365 }
 *         description: عدد الأيام للرجوع للخلف
 *     responses:
 *       200: { description: ✅ تقدم الرحلة }
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
 *     responses:
 *       200: { description: ✅ تم التحديث }
 */
journeyRouter.patch('/quran-pages', authenticate, updateQuranPagesHandler);

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
 *     responses:
 *       200: { description: ✅ تمت الزيادة }
 */
journeyRouter.post('/quran-pages/increment', authenticate, incrementQuranPagesHandler);

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
 *     responses:
 *       200: { description: ✅ تم التحديث }
 */
journeyRouter.patch('/adhkar', authenticate, updateAdhkarHandler);

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
 *     responses:
 *       200: { description: ✅ تم التحديث }
 */
journeyRouter.patch('/sadaqah', authenticate, updateSadaqahHandler);

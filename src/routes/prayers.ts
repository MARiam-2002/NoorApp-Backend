import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getSchedule,
  getToday,
  markPrayerHandler,
} from '../controllers/prayer.controller';

export const prayerRouter = Router();

/**
 * @openapi
 * /prayers/today:
 *   get:
 *     tags: ['Prayers']
 *     summary: أوقات الصلاة لليوم الحالي مع حالة التسجيل
 *     description: يرجع أوقات الخمس صلوات مع إشارة لكل صلاة إذا تم تسجيلها أم لا، بالإضافة إلى الصلاة الحالية والقادمة مع العداد التنازلي.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ✅ أوقات الصلاة لليوم
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: أوقات الصلاة لليوم
 *               data:
 *                 date: '2026-07-27'
 *                 city: القاهرة
 *                 country: Egypt
 *                 latitude: 30.0444
 *                 longitude: 31.2357
 *                 currentPrayer: DHUHR
 *                 nextPrayer: ASR
 *                 nextPrayerAt: '2026-07-27T15:24:00.000Z'
 *                 countdownSeconds: 5830
 *                 prayers:
 *                   - id: FAJR
 *                     nameAr: الفجر
 *                     nameEn: Fajr
 *                     time: '03:42'
 *                     time24h: '03:42:00'
 *                     completed: true
 *                     completedAt: '2026-07-27T03:45:12.000Z'
 *                   - id: DHUHR
 *                     nameAr: الظهر
 *                     nameEn: Dhuhr
 *                     time: '12:30'
 *                     time24h: '12:30:00'
 *                     completed: true
 *                     completedAt: '2026-07-27T12:32:00.000Z'
 *                   - id: ASR
 *                     nameAr: العصر
 *                     nameEn: Asr
 *                     time: '15:24'
 *                     time24h: '15:24:00'
 *                     completed: false
 *                     completedAt: null
 *                   - id: MAGHRIB
 *                     nameAr: المغرب
 *                     nameEn: Maghrib
 *                     time: '18:49'
 *                     time24h: '18:49:00'
 *                     completed: false
 *                     completedAt: null
 *                   - id: ISHA
 *                     nameAr: العشاء
 *                     nameEn: Isha
 *                     time: '20:18'
 *                     time24h: '20:18:00'
 *                     completed: false
 *                     completedAt: null
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
prayerRouter.get('/today', authenticate, getToday);

/**
 * @openapi
 * /prayers/{id}/mark:
 *   patch:
 *     tags: ['Prayers']
 *     summary: تبديل حالة إتمام صلاة معينة (صليت / لم أصل)
 *     description: عند الضغط على دائرة الصلاة في شاشة الرئيسية أو شاشة الصلوات - يضيف أو يحذف تسجيل الصلاة مع تاريخ اليوم.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           enum: [FAJR, DHUHR, ASR, MAGHRIB, ISHA]
 *         description: اسم الصلاة بالإنجليزي (من الـ enum)
 *         example: ASR
 *     responses:
 *       200:
 *         description: ✅ تم تبديل حالة الصلاة بنجاح
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم تسجيل صلاة العصر بنجاح
 *               data:
 *                 prayerId: ASR
 *                 completed: true
 *                 completedAt: '2026-07-27T15:30:00.000Z'
 *                 completedToday: 3
 *                 remainingToday: 2
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       400:
 *         description: ❌ نوع الصلاة غير صالح
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: VALIDATION_ERROR
 *               message: 'نوع الصلاة غير صالح. القيم المتاحة: FAJR, DHUHR, ASR, MAGHRIB, ISHA'
 *               details: [{ field: id, message: 'Invalid enum value' }]
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
prayerRouter.patch('/:id/mark', authenticate, markPrayerHandler);

/**
 * @openapi
 * /prayers/schedule:
 *   get:
 *     tags: ['Prayers']
 *     summary: حساب أوقات الصلاة لموقع وتاريخ معين
 *     description: يرجع أوقات الصلاة بناءً على خطوط الطول والعرض والمنطقة الزمنية والتاريخ.
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema: { type: number, example: 30.0444 }
 *         description: خط العرض
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema: { type: number, example: 31.2357 }
 *         description: خط الطول
 *       - in: query
 *         name: timezone
 *         schema: { type: string, example: Africa/Cairo }
 *         description: المنطقة الزمنية
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date, example: '2026-07-27' }
 *         description: التاريخ (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: ✅ أوقات الصلاة
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم حساب أوقات الصلاة بنجاح
 *               data:
 *                 date: '2026-07-27'
 *                 latitude: 30.0444
 *                 longitude: 31.2357
 *                 timezone: Africa/Cairo
 *                 method: EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY
 *                 prayers:
 *                   - id: IMSAK
 *                     nameAr: الإمساك
 *                     time: '03:32'
 *                   - id: FAJR
 *                     nameAr: الفجر
 *                     time: '03:42'
 *                   - id: SUNRISE
 *                     nameAr: الشروق
 *                     time: '05:12'
 *                   - id: DHUHR
 *                     nameAr: الظهر
 *                     time: '12:30'
 *                   - id: ASR
 *                     nameAr: العصر
 *                     time: '15:24'
 *                   - id: MAGHRIB
 *                     nameAr: المغرب
 *                     time: '18:49'
 *                   - id: ISHA
 *                     nameAr: العشاء
 *                     time: '20:18'
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
prayerRouter.get('/schedule', getSchedule);

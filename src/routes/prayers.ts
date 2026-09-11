import { Router } from 'express';

import { authenticate, optionalAuthenticate } from '../middleware/auth';
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
 *     summary: Today's prayer times (Cairo default before login/location)
 *     description: |
 *       - Guest, no lat/lng → Cairo, Egypt defaults (`locationSource=default_cairo`).
 *       - With lat/lng query → those coordinates (`locationSource=query`).
 *       - Authenticated, no lat/lng → saved profile location, else Cairo (`profile` or `default_cairo`).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: latitude
 *         schema: { type: number, example: 30.0444 }
 *       - in: query
 *         name: longitude
 *         schema: { type: number, example: 31.2357 }
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *       - in: query
 *         name: timezone
 *         schema: { type: string, example: Africa/Cairo }
 *       - in: query
 *         name: method
 *         schema: { type: string, example: EGYPT }
 *       - in: query
 *         name: madhab
 *         schema: { type: string, example: SHAFI }
 *     responses:
 *       200:
 *         description: Prayer schedule for today
 */
prayerRouter.get('/today', optionalAuthenticate, getToday);

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
 *                 prayer: Asr
 *                 key: ASR
 *                 completed: true
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
 *     summary: Prayer schedule for a location/date (Cairo if coords omitted)
 *     description: |
 *       Public endpoint. If latitude/longitude are omitted, Backend returns Cairo, Egypt defaults.
 *     parameters:
 *       - in: query
 *         name: latitude
 *         schema: { type: number, example: 30.0444 }
 *       - in: query
 *         name: longitude
 *         schema: { type: number, example: 31.2357 }
 *       - in: query
 *         name: timezone
 *         schema: { type: string, example: Africa/Cairo }
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date, example: '2026-09-07' }
 *       - in: query
 *         name: method
 *         schema: { type: string, example: EGYPT }
 *       - in: query
 *         name: madhab
 *         schema: { type: string, example: SHAFI }
 *     responses:
 *       200:
 *         description: Prayer schedule
 */
prayerRouter.get('/schedule', getSchedule);

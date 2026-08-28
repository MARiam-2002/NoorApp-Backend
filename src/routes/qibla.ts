import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../lib/validation';
import {
  calculateQiblaHandler,
  getMyQiblaHandler,
} from '../controllers/qibla.controller';

const calculateQiblaSchema = z.preprocess(
  (raw) => {
    const q = (raw ?? {}) as Record<string, unknown>;
    return {
      latitude: q.latitude ?? q.lat,
      longitude: q.longitude ?? q.lng,
    };
  },
  z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
  }),
);

export const qiblaRouter = Router();

/**
 * @openapi
 * /qibla/calculate:
 *   get:
 *     tags: ['Qibla']
 *     summary: حساب اتجاه القبلة من أي موقع جغرافي
 *     description: |
 *       نقطة الوصول الرئيسية لشاشة القبلة. تقوم بحساب زاوية البوصلة المطلوبة لاتجاه الكعبة المشرفة في مكة المكرمة (21.4225 درجة شمالاً، 39.8262 درجة شرقاً) باستخدام معادلة Great Circle Bearing.
 *
 *       البيانات المرجعة:
 *       - `bearingDegrees`: الزاوية بالدرجات من الشمال (0 = الشمال، 90 = الشرق، 180 = الجنوب، 270 = الغرب)
 *       - `bearingRadians`: نفس الزاوية بوحدة الراديان (مفيدة لحركات البوصلة داخل تطبيق Flutter)
 *       - `directionAr`: اسم الاتجاه باللغة العربية (مثل: الجنوب الشرقي)
 *       - `distanceKm`: المسافة بالمتر لتبعد المسجد الحرام
 *       - `kaaba`: إحداثيات الكعبة الثابتة للمرجعية
 *
 *       ملاحظات التطوير داخل Flutter:
 *       1. قم بجلب قيمة heading (اتجاه الهاتف) من مستشعر البوصلة
 *       2. قم بحساب زاوية دوران سهم القبلة كالتالي: `(bearingDegrees - heading)` حتى يبقى السهم متجهاً للقبلة مهما كان اتجاه الهاتف.
 *
 *       ملاحظة: نقطة الوصول هذه عامة ولا تتطلب توثيق. يمكن عرضها حتى لو لم يقم المستخدم بتسجيل الدخول.
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         description: خط عرض المستخدم الحالي (GPS) من -90 إلى 90
 *         schema:
 *           type: number
 *           example: 30.0444
 *       - in: query
 *         name: lng
 *         required: true
 *         description: خط طول المستخدم الحالي (GPS) من -180 إلى 180
 *         schema:
 *           type: number
 *           example: 31.2357
 *     responses:
 *       200:
 *         description: زاوية اتجاه القبلة
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/QiblaResponse'
 *             example:
 *               success: true
 *               message: تم حساب اتجاه القبلة بنجاح
 *               data:
 *                 bearingDegrees: 215.67
 *                 bearingRadians: 3.764
 *                 directionAr: الجنوب الغربي
 *                 distanceKm: 1246.35
 *                 kaaba:
 *                   latitude: 21.4225
 *                   longitude: 39.8262
 *                 userLocation:
 *                   latitude: 30.0444
 *                   longitude: 31.2357
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
qiblaRouter.get(
  '/calculate',
  validate(calculateQiblaSchema, 'query'),
  calculateQiblaHandler,
);

/**
 * @openapi
 * /qibla/my-qibla:
 *   get:
 *     tags: ['Qibla']
 *     summary: اتجاه القبلة بناءً على الموقع المحفوظ في الملف الشخصي
 *     description: يقوم بنفس الحساب السابق ولكن باستخدام خطوط العرض والطول المحفوظة في الملف الشخصي للمستخدم من خلال نقطة تحديث الموقع. تستخدم في حالة عدم توفر قراءة GPS فعلياً وتوفر الموقع المحفوظ سابقاً.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: زاوية اتجاه القبلة بناءً على الموقع المحفوظ
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/QiblaResponse'
 *             example:
 *               success: true
 *               message: اتجاه القبلة بناءً على الموقع المحفوظ
 *               data:
 *                 bearingDegrees: 215.67
 *                 bearingRadians: 3.764
 *                 directionAr: الجنوب الغربي
 *                 distanceKm: 1246.35
 *                 kaaba:
 *                   latitude: 21.4225
 *                   longitude: 39.8262
 *                 userLocation:
 *                   latitude: 30.0444
 *                   longitude: 31.2357
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       400:
 *         description: لم يتم حفظ موقع جغرافي للمستخدم بعد
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               code: LOCATION_NOT_SET
 *               message: لم يتم حفظ موقع جغرافي للمستخدم بعد. يرجى تحديث الموقع من إعدادات الملف الشخصي.
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
qiblaRouter.get('/my-qibla', authenticate, getMyQiblaHandler);

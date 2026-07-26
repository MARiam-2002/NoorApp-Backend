"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qiblaRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../lib/validation");
const qibla_controller_1 = require("../controllers/qibla.controller");
const calculateQiblaSchema = zod_1.z.object({
    latitude: zod_1.z.coerce.number().min(-90).max(90),
    longitude: zod_1.z.coerce.number().min(-180).max(180),
});
exports.qiblaRouter = (0, express_1.Router)();
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
 *           example: 24.7136
 *       - in: query
 *         name: lng
 *         required: true
 *         description: خط طول المستخدم الحالي (GPS) من -180 إلى 180
 *         schema:
 *           type: number
 *           example: 46.6753
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
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
exports.qiblaRouter.get('/calculate', (0, validation_1.validate)(calculateQiblaSchema, 'query'), qibla_controller_1.calculateQiblaHandler);
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
 *       400:
 *         description: لم يتم حفظ موقع جغرافي للمستخدم بعد
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
exports.qiblaRouter.get('/my-qibla', auth_1.authenticate, qibla_controller_1.getMyQiblaHandler);
//# sourceMappingURL=qibla.js.map
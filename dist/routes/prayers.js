"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prayerRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prayer_controller_1 = require("../controllers/prayer.controller");
exports.prayerRouter = (0, express_1.Router)();
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
 *       401:
 *         description: ❌ غير مصرح به
 */
exports.prayerRouter.get('/today', auth_1.authenticate, prayer_controller_1.getToday);
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
 *       400:
 *         description: ❌ نوع الصلاة غير صالح
 *       401:
 *         description: ❌ غير مصرح به
 */
exports.prayerRouter.patch('/:id/mark', auth_1.authenticate, prayer_controller_1.markPrayerHandler);
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
 *         schema: { type: number, example: 30.0444 }
 *         description: خط العرض
 *       - in: query
 *         name: longitude
 *         schema: { type: number, example: 31.2357 }
 *         description: خط الطول
 *       - in: query
 *         name: timezone
 *         schema: { type: string, example: Africa/Cairo }
 *         description: المنطقة الزمنية
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: التاريخ (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: ✅ أوقات الصلاة
 */
exports.prayerRouter.get('/schedule', prayer_controller_1.getSchedule);
//# sourceMappingURL=prayers.js.map
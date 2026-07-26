"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentRouter = void 0;
const express_1 = require("express");
const content_controller_1 = require("../controllers/content.controller");
exports.contentRouter = (0, express_1.Router)();
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
exports.contentRouter.get('/verse-of-day', content_controller_1.getVerseOfDayHandler);
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
exports.contentRouter.get('/hadith-of-day', content_controller_1.getHadithOfDayHandler);
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
exports.contentRouter.get('/daily-challenge', content_controller_1.getDailyChallengeHandler);
//# sourceMappingURL=content.js.map
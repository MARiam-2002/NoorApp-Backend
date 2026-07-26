"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.challengesRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const challenge_controller_1 = require("../controllers/challenge.controller");
exports.challengesRouter = (0, express_1.Router)();
/**
 * @openapi
 * /challenges:
 *   get:
 *     tags: ['Challenges']
 *     summary: قائمة التحديات (حالياً تحدي اليوم)
 *     description: بيانات التحديات المتاحة للمستخدم مع حالة التحدي اليومي.
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: ✅ التحديات }
 */
exports.challengesRouter.get('/', auth_1.authenticate, challenge_controller_1.getChallenges);
/**
 * @openapi
 * /challenges/today:
 *   get:
 *     tags: ['Challenges']
 *     summary: تفاصيل تحدي اليوم وحالة إنجازه
 *     description: بيانات بطاقة "تحدي اليوم" في شاشة الرئيسية + شاشة التحديات.
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: ✅ تفاصيل تحدي اليوم }
 */
exports.challengesRouter.get('/today', auth_1.authenticate, challenge_controller_1.getToday);
/**
 * @openapi
 * /challenges/today/claim:
 *   post:
 *     tags: ['Challenges']
 *     summary: استلام مكافأة تحدي اليوم (بعد إتمامه)
 *     description: بعد أن يتحقق شرط التحدي (صفحات القرآن / الصلوات ...)، المستخدم يضغط على زر "استلام المكافأة" لنحله ويضاف للنقاط.
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: ✅ تم استلام المكافأة }
 *       400: { description: ❌ التحدي لم يكتمل بعد أو تم استلام المكافأة مسبقاً }
 */
exports.challengesRouter.post('/today/claim', auth_1.authenticate, challenge_controller_1.claimToday);
/**
 * @openapi
 * /challenges/{id}:
 *   get:
 *     tags: ['Challenges']
 *     summary: تفاصيل تحدي معين حسب رقم اليوم في السنة
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 200 }
 *         description: رقم اليوم في السنة (1-366)
 *     responses:
 *       200: { description: ✅ تفاصيل التحدي }
 *       404: { description: ❌ التحدي غير موجود }
 */
exports.challengesRouter.get('/:id', auth_1.authenticate, challenge_controller_1.getChallengeById);
/**
 * @openapi
 * /challenges/{id}/claim:
 *   post:
 *     tags: ['Challenges']
 *     summary: استلام مكافأة تحدي معين
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 200 }
 *         description: رقم اليوم في السنة (1-366)
 *     responses:
 *       200: { description: ✅ تم استلام المكافأة }
 *       400: { description: ❌ لم يكتمل شرط التحدي }
 *       404: { description: ❌ التحدي غير موجود }
 *       409: { description: ❌ تم استلام المكافأة مسبقاً }
 */
exports.challengesRouter.post('/:id/claim', auth_1.authenticate, challenge_controller_1.claimChallengeHandler);
//# sourceMappingURL=challenges.js.map
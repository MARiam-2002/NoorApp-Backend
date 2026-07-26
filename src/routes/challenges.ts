import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  claimChallengeHandler,
  claimToday,
  getChallengeById,
  getChallenges,
  getToday,
} from '../controllers/challenge.controller';

export const challengesRouter = Router();

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
challengesRouter.get('/', authenticate, getChallenges);

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
challengesRouter.get('/today', authenticate, getToday);

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
challengesRouter.post('/today/claim', authenticate, claimToday);

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
challengesRouter.get('/:id', authenticate, getChallengeById);

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
challengesRouter.post('/:id/claim', authenticate, claimChallengeHandler);

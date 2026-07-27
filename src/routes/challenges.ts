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
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, example: 1 }
 *         description: رقم الصفحة
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30, example: 30 }
 *         description: عدد العناصر في الصفحة
 *     responses:
 *       200:
 *         description: ✅ التحديات
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم جلب التحديات بنجاح
 *               data:
 *                 - id: 208
 *                   dayOfYear: 208
 *                   titleAr: اقرأ صفحتين من القرآن
 *                   descriptionAr: اقرأ صفحتين على الأقل من القرآن الكريم اليوم
 *                   type: QURAN_PAGES
 *                   target: 2
 *                   rewardPoints: 50
 *                   currentValue: 3
 *                   completed: true
 *                   claimed: false
 *                 - id: 209
 *                   dayOfYear: 209
 *                   titleAr: صلِ الخمس صلوات في وقتها
 *                   descriptionAr: احرص على أداء جميع الصلوات في أوقاتها اليوم
 *                   type: PRAYERS_ALL
 *                   target: 5
 *                   rewardPoints: 80
 *                   currentValue: 0
 *                   completed: false
 *                   claimed: false
 *               meta:
 *                 page: 1
 *                 limit: 30
 *                 total: 366
 *                 totalPages: 13
 *                 hasNext: true
 *                 hasPrev: false
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
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
 *       200:
 *         description: ✅ تفاصيل تحدي اليوم
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تفاصيل تحدي اليوم
 *               data:
 *                 id: 208
 *                 dayOfYear: 208
 *                 date: '2026-07-27'
 *                 titleAr: اقرأ صفحتين من القرآن
 *                 descriptionAr: اقرأ صفحتين على الأقل من القرآن الكريم اليوم
 *                 type: QURAN_PAGES
 *                 target: 2
 *                 rewardPoints: 50
 *                 currentValue: 3
 *                 completed: true
 *                 claimed: false
 *                 progressPercent: 150
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
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
 *       200:
 *         description: ✅ تم استلام المكافأة
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم استلام مكافأة تحدي اليوم بنجاح
 *               data:
 *                 challengeId: 208
 *                 pointsEarned: 50
 *                 totalPoints: 2500
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       400:
 *         description: ❌ التحدي لم يكتمل بعد أو تم استلام المكافأة مسبقاً
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: CHALLENGE_NOT_COMPLETED
 *               message: لم يتم إكمال شرط التحدي بعد
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
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
 *       200:
 *         description: ✅ تفاصيل التحدي
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تفاصيل التحدي
 *               data:
 *                 id: 200
 *                 dayOfYear: 200
 *                 titleAr: 100 تسبيح
 *                 descriptionAr: سبّح الله مئة مرة اليوم
 *                 type: TASBIH
 *                 target: 100
 *                 rewardPoints: 30
 *                 currentValue: 0
 *                 completed: false
 *                 claimed: false
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       404:
 *         description: ❌ التحدي غير موجود
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: NOT_FOUND
 *               message: التحدي غير موجود
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
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
 *       200:
 *         description: ✅ تم استلام المكافأة
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم استلام المكافأة بنجاح
 *               data:
 *                 challengeId: 200
 *                 pointsEarned: 30
 *                 totalPoints: 2480
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       400:
 *         description: ❌ لم يكتمل شرط التحدي
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: CHALLENGE_NOT_COMPLETED
 *               message: لم يتم إكمال شرط التحدي بعد
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       404:
 *         description: ❌ التحدي غير موجود
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: NOT_FOUND
 *               message: التحدي غير موجود
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       409:
 *         description: ❌ تم استلام المكافأة مسبقاً
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: ALREADY_CLAIMED
 *               message: تم استلام مكافأة هذا التحدي مسبقاً
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
challengesRouter.post('/:id/claim', authenticate, claimChallengeHandler);

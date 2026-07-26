import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../lib/validation';
import {
  getTodayHandler,
  incrementHandler,
  resetTodayHandler,
  changeDhikrHandler,
  getHistoryHandler,
} from '../controllers/tasbih.controller';

const DhikrEnum = z.enum([
  'SUBHAN_ALLAH',
  'ALHAMDULILLAH',
  'LA_ILAHA_ILLA_ALLAH',
  'ALLAHU_AKBAR',
  'ASTAGHFIRULLAH',
  'LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH',
]);

const incrementTasbihSchema = z.object({
  amount: z.coerce.number().int().min(1).default(1).optional(),
});

const changeDhikrSchema = z.object({
  dhikr: DhikrEnum,
});

const tasbihHistorySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30).optional(),
});

export const tasbihRouter = Router();

/**
 * @openapi
 * /tasbih/today:
 *   get:
 *     tags: ['Tasbih']
 *     summary: حالة المسبحة لليوم الحالي
 *     description: |
 *       شاشة المسبحة الرئيسية. يقوم بإرجاع إجمالي التسبيحات اليوم، والذكر الحالي المختار، وهدف اليوم، وآخر تعديل للذكر.
 *
 *       البيانات المرجعة:
 *       - `todayCount`: عدد التسبيحات التي قام بها المستخدم اليوم
 *       - `currentDhikr`: اسم الذكر الحالي بالإنجليزي (مثل: SUBHAN_ALLAH)
 *       - `currentDhikrAr`: اسم الذكر بالعربي (مثل: سبحان الله)
 *       - `currentDhikrCount`: عدد مرات التكرار للذكر الحالي
 *       - `dailyGoal`: عدد التسبيحات المستهدف اليوم (افتراضي 99 أو حسب الإعدادات)
 *       - `lastDhikrChangeAt`: تاريخ آخر تغيير للذكر
 *
 *       هذا الاستدعاء هو الاستدعاء الأولي عند فتح شاشة المسبحة داخل تطبيق Flutter.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: بيانات المسبحة لليوم الحالي
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TasbihToday'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
tasbihRouter.get('/today', authenticate, getTodayHandler);

/**
 * @openapi
 * /tasbih/history:
 *   get:
 *     tags: ['Tasbih']
 *     summary: سجل التسبيحات السابق مع تقسيم الصفحات
 *     description: قائمة بتاريخ التسبيحات اليومية للمستخدم لجميع الأيام السابقة. تستخدم في شاشة السجل أو الإحصائيات داخل المسبحة.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: قائمة سجل التسبيحات
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
tasbihRouter.get(
  '/history',
  authenticate,
  validate(tasbihHistorySchema, 'query'),
  getHistoryHandler,
);

/**
 * @openapi
 * /tasbih/increment:
 *   post:
 *     tags: ['Tasbih']
 *     summary: زيادة عداد المسبحة بمقدار واحد
 *     description: |
 *       هذا هو النقطة الأساسية عند النقر على الزر الدائري في منتصف شاشة المسبحة. يقوم بزيادة عداد الذكر الحالي وعداد اليوم بواحد، ثم يقوم بإرجاع التعداد الجديد لتحديث واجهة المستخدم مباشرة دون الحاجة لإعادة استدعاء بيانات اليوم كاملة.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TasbihIncrementRequest'
 *     responses:
 *       200:
 *         description: تم زيادة العداد بنجاح
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TasbihToday'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
tasbihRouter.post(
  '/increment',
  authenticate,
  validate(incrementTasbihSchema),
  incrementHandler,
);

/**
 * @openapi
 * /tasbih/reset:
 *   post:
 *     tags: ['Tasbih']
 *     summary: إعادة ضبط عداد اليوم للصفر
 *     description: يقوم بإعادة ضبط عداد اليوم والذكر الحالي للقيمة الصفرية. يقوم بحفظ المجموع في سجل التاريخ قبل إعادة الضبط لعدم ضياع البيانات. يستخدم من زر إعادة الضبط في شاشة المسبحة.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تمت إعادة ضبط العداد بنجاح
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TasbihToday'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
tasbihRouter.post('/reset', authenticate, resetTodayHandler);

/**
 * @openapi
 * /tasbih/change-dhikr:
 *   patch:
 *     tags: ['Tasbih']
 *     summary: تغيير الذكر الحالي
 *     description: |
 *       يستخدم عند فتح قائمة تغيير الذكر أو النقر على اسم الذكر أعلى الدائرة في الشاشة الرئيسية للمسبحة.
 *
 *       القيم المتاحة للذكر:
 *       - SUBHAN_ALLAH → سبحان الله
 *       - ALHAMDULILLAH → الحمد لله
 *       - LA_ILAHA_ILLA_ALLAH → لا إله إلا الله
 *       - ALLAHU_AKBAR → الله أكبر
 *       - ASTAGHFIRULLAH → أستغفر الله
 *       - LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH → لا حول ولا قوة إلا بالله
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TasbihChangeDhikrRequest'
 *     responses:
 *       200:
 *         description: تم تغيير الذكر بنجاح
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TasbihToday'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
tasbihRouter.patch(
  '/change-dhikr',
  authenticate,
  validate(changeDhikrSchema),
  changeDhikrHandler,
);

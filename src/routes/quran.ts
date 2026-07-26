import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../lib/validation';
import {
  listSurahsHandler,
  getSurahHandler,
  listAyahsHandler,
  listBookmarksHandler,
  createBookmarkHandler,
  deleteBookmarkHandler,
  getLastReadHandler,
  updateLastReadHandler,
  listReadingHistoryHandler,
  recordReadingHistoryHandler,
  getKhatmahHandler,
  updateKhatmahHandler,
} from '../controllers/quran.controller';

const surahIdParamSchema = z.object({
  surahId: z.coerce.number().int().min(1).max(114),
});

const listAyahsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  perPage: z.coerce.number().int().min(1).max(200).default(20).optional(),
});

const createBookmarkSchema = z.object({
  surahId: z.coerce.number().int().min(1).max(114),
  ayahNumber: z.coerce.number().int().min(1).optional(),
  page: z.coerce.number().int().min(1).max(604).optional(),
  note: z.string().max(500).optional(),
});

const bookmarkIdParamSchema = z.object({
  bookmarkId: z.string().min(1),
});

const updateLastReadSchema = z.object({
  surahId: z.coerce.number().int().min(1).max(114),
  ayahNumber: z.coerce.number().int().min(1).optional(),
  page: z.coerce.number().int().min(1).max(604),
});

const readingHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

const recordReadingHistorySchema = z.object({
  surahId: z.coerce.number().int().min(1).max(114),
  fromAyah: z.coerce.number().int().min(1).optional(),
  toAyah: z.coerce.number().int().min(1).optional(),
  pagesRead: z.coerce.number().int().min(1).max(604),
});

const updateKhatmahSchema = z.object({
  currentPage: z.coerce.number().int().min(1).max(604),
});

export const quranRouter = Router();

/**
 * @openapi
 * /quran/surahs:
 *   get:
 *     tags: ['Quran']
 *     summary: قائمة جميع سور القرآن الكريم
 *     description: يعرض قائمة بالـ 114 سورة مع الاسم العربي والإنجليزي وعدد الآيات وعدد الصفحات.
 *     responses:
 *       200:
 *         description: ✅ قائمة السور
 */
quranRouter.get('/surahs', listSurahsHandler);

/**
 * @openapi
 * /quran/surahs/{surahId}:
 *   get:
 *     tags: ['Quran']
 *     summary: تفاصيل سورة معينة
 *     parameters:
 *       - in: path
 *         name: surahId
 *         required: true
 *         schema: { type: integer, example: 1 }
 *         description: رقم السورة (من 1 إلى 114) - مثلاً الفاتحة = 1
 *     responses:
 *       200:
 *         description: ✅ تفاصيل السورة
 *       404:
 *         description: ❌ السورة غير موجودة
 */
quranRouter.get('/surahs/:surahId', validate(surahIdParamSchema, 'params'), getSurahHandler);

/**
 * @openapi
 * /quran/surahs/{surahId}/ayahs:
 *   get:
 *     tags: ['Quran']
 *     summary: قائمة آيات سورة معينة (صفحات مفصولة)
 *     parameters:
 *       - in: path
 *         name: surahId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: perPage
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 200 }
 *     responses:
 *       200:
 *         description: ✅ قائمة الآيات
 */
quranRouter.get(
  '/surahs/:surahId/ayahs',
  validate(surahIdParamSchema, 'params'),
  validate(listAyahsQuerySchema, 'query'),
  listAyahsHandler,
);

/**
 * @openapi
 * /quran/bookmarks:
 *   get:
 *     tags: ['Quran']
 *     summary: قائمة علامات القرآن للمستخدم
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: ✅ قائمة العلامات }
 */
quranRouter.get('/bookmarks', authenticate, listBookmarksHandler);

/**
 * @openapi
 * /quran/bookmarks:
 *   post:
 *     tags: ['Quran']
 *     summary: إضافة علامة جديدة في القرآن
 *     description: حفظ آية معينة للرجوع لها لاحقاً.
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [surahId, ayahNumber]
 *             properties:
 *               surahId: { type: integer, example: 2 }
 *               ayahNumber: { type: integer, example: 255 }
 *               note:
 *                 type: string
 *                 nullable: true
 *                 example: "آية الكرسي - قرأتها صباحاً"
 *     responses:
 *       201: { description: ✅ تمت إضافة العلامة }
 *       409: { description: ❌ الآية محفوظة بالفعل }
 */
quranRouter.post(
  '/bookmarks',
  authenticate,
  validate(createBookmarkSchema),
  createBookmarkHandler,
);

/**
 * @openapi
 * /quran/bookmarks/{bookmarkId}:
 *   delete:
 *     tags: ['Quran']
 *     summary: حذف علامة قرآن
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: bookmarkId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: ✅ تم الحذف }
 */
quranRouter.delete(
  '/bookmarks/:bookmarkId',
  authenticate,
  validate(bookmarkIdParamSchema, 'params'),
  deleteBookmarkHandler,
);

/**
 * @openapi
 * /quran/last-read:
 *   get:
 *     tags: ['Quran']
 *     summary: آخر موضع قرأه المستخدم (متابعة القراءة)
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: ✅ آخر قراءة }
 */
quranRouter.get('/last-read', authenticate, getLastReadHandler);

/**
 * @openapi
 * /quran/last-read:
 *   put:
 *     tags: ['Quran']
 *     summary: تحديث آخر موضع قرأه المستخدم
 *     description: يستدعى هذا تلقائياً في الـ Flutter كلما تغيرت الآية المعروضة في الشاشة.
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [surahId, ayahNumber]
 *             properties:
 *               surahId: { type: integer, example: 2 }
 *               ayahNumber: { type: integer, example: 286 }
 *               page: { type: integer, nullable: true, example: 60 }
 *     responses:
 *       200: { description: ✅ تم التحديث }
 */
quranRouter.put('/last-read', authenticate, validate(updateLastReadSchema), updateLastReadHandler);

/**
 * @openapi
 * /quran/reading-history:
 *   get:
 *     tags: ['Quran']
 *     summary: سجل عمليات القراءة السابقة
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: perPage
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: ✅ سجل القراءة }
 */
quranRouter.get(
  '/reading-history',
  authenticate,
  validate(readingHistoryQuerySchema, 'query'),
  listReadingHistoryHandler,
);

/**
 * @openapi
 * /quran/reading-history:
 *   post:
 *     tags: ['Quran']
 *     summary: تسجيل قراءة آيات جديدة (في نهاية الجلسة)
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [surahId, ayahFrom, ayahTo]
 *             properties:
 *               surahId: { type: integer, example: 2 }
 *               ayahFrom: { type: integer, example: 1 }
 *               ayahTo: { type: integer, example: 20 }
 *     responses:
 *       201: { description: ✅ تم تسجيل القراءة }
 */
quranRouter.post(
  '/reading-history',
  authenticate,
  validate(recordReadingHistorySchema),
  recordReadingHistoryHandler,
);

/**
 * @openapi
 * /quran/khatmah:
 *   get:
 *     tags: ['Quran']
 *     summary: حالة الختمة الحالية للمستخدم
 *     description: |
 *       بيانات استكمال الختمة: السورة الحالية، الصفحة الحالية، إجمالي الصفحات المقروءة.
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: ✅ حالة الختمة }
 */
quranRouter.get('/khatmah', authenticate, getKhatmahHandler);

/**
 * @openapi
 * /quran/khatmah/progress:
 *   patch:
 *     tags: ['Quran']
 *     summary: تحديث تقدم الختمة (الانتقال لصفحة أو سورة جديدة)
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               surahId: { type: integer, example: 3 }
 *               currentPage: { type: integer, example: 40 }
 *     responses:
 *       200: { description: ✅ تم تحديث التقدم }
 */
quranRouter.patch(
  '/khatmah/progress',
  authenticate,
  validate(updateKhatmahSchema),
  updateKhatmahHandler,
);

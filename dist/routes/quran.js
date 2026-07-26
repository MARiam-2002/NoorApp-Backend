"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quranRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../lib/validation");
const quran_controller_1 = require("../controllers/quran.controller");
const surahIdParamSchema = zod_1.z.object({
    surahId: zod_1.z.coerce.number().int().min(1).max(114),
});
const listAyahsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1).optional(),
    perPage: zod_1.z.coerce.number().int().min(1).max(200).default(20).optional(),
});
const createBookmarkSchema = zod_1.z.object({
    surahId: zod_1.z.coerce.number().int().min(1).max(114),
    ayahNumber: zod_1.z.coerce.number().int().min(1).optional(),
    page: zod_1.z.coerce.number().int().min(1).max(604).optional(),
    note: zod_1.z.string().max(500).optional(),
});
const bookmarkIdParamSchema = zod_1.z.object({
    bookmarkId: zod_1.z.string().min(1),
});
const updateLastReadSchema = zod_1.z.object({
    surahId: zod_1.z.coerce.number().int().min(1).max(114),
    ayahNumber: zod_1.z.coerce.number().int().min(1).optional(),
    page: zod_1.z.coerce.number().int().min(1).max(604),
});
const readingHistoryQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20).optional(),
});
const recordReadingHistorySchema = zod_1.z.object({
    surahId: zod_1.z.coerce.number().int().min(1).max(114),
    fromAyah: zod_1.z.coerce.number().int().min(1).optional(),
    toAyah: zod_1.z.coerce.number().int().min(1).optional(),
    pagesRead: zod_1.z.coerce.number().int().min(1).max(604),
});
const updateKhatmahSchema = zod_1.z.object({
    currentPage: zod_1.z.coerce.number().int().min(1).max(604),
});
exports.quranRouter = (0, express_1.Router)();
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
exports.quranRouter.get('/surahs', quran_controller_1.listSurahsHandler);
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
exports.quranRouter.get('/surahs/:surahId', (0, validation_1.validate)(surahIdParamSchema, 'params'), quran_controller_1.getSurahHandler);
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
exports.quranRouter.get('/surahs/:surahId/ayahs', (0, validation_1.validate)(surahIdParamSchema, 'params'), (0, validation_1.validate)(listAyahsQuerySchema, 'query'), quran_controller_1.listAyahsHandler);
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
exports.quranRouter.get('/bookmarks', auth_1.authenticate, quran_controller_1.listBookmarksHandler);
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
exports.quranRouter.post('/bookmarks', auth_1.authenticate, (0, validation_1.validate)(createBookmarkSchema), quran_controller_1.createBookmarkHandler);
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
exports.quranRouter.delete('/bookmarks/:bookmarkId', auth_1.authenticate, (0, validation_1.validate)(bookmarkIdParamSchema, 'params'), quran_controller_1.deleteBookmarkHandler);
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
exports.quranRouter.get('/last-read', auth_1.authenticate, quran_controller_1.getLastReadHandler);
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
exports.quranRouter.put('/last-read', auth_1.authenticate, (0, validation_1.validate)(updateLastReadSchema), quran_controller_1.updateLastReadHandler);
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
exports.quranRouter.get('/reading-history', auth_1.authenticate, (0, validation_1.validate)(readingHistoryQuerySchema, 'query'), quran_controller_1.listReadingHistoryHandler);
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
exports.quranRouter.post('/reading-history', auth_1.authenticate, (0, validation_1.validate)(recordReadingHistorySchema), quran_controller_1.recordReadingHistoryHandler);
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
exports.quranRouter.get('/khatmah', auth_1.authenticate, quran_controller_1.getKhatmahHandler);
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
exports.quranRouter.patch('/khatmah/progress', auth_1.authenticate, (0, validation_1.validate)(updateKhatmahSchema), quran_controller_1.updateKhatmahHandler);
//# sourceMappingURL=quran.js.map
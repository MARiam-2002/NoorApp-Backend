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
  updateBookmarkHandler,
  deleteBookmarkHandler,
  getLastReadHandler,
  updateLastReadHandler,
  listReadingHistoryHandler,
  recordReadingHistoryHandler,
  getKhatmahHandler,
  updateKhatmahHandler,
  resetKhatmahHandler,
  listJuzHandler,
  listJuzSurahsHandler,
  listAyahsByPageHandler,
  getKhatmahStatsHandler,
  searchQuranHandler,
  getRandomAyahHandler,
  getFullQuranCatalogHandler,
  listAyahsByJuzHandler,
  importLocalDataHandler,
} from '../controllers/quran.controller';

const surahIdParamSchema = z.object({
  surahId: z.coerce.number().int().min(1).max(114),
});

const juzNumberParamSchema = z.object({
  juzNumber: z.coerce.number().int().min(1).max(30),
});

const pageNumberParamSchema = z.object({
  pageNumber: z.coerce.number().int().min(1).max(604),
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
}).refine((d) => d.ayahNumber != null || d.page != null, { message: 'Either ayahNumber or page is required for a bookmark', path: ['ayahNumber', 'page'] });

const updateBookmarkSchema = z.object({
  note: z.string().max(500).default(''),
});

const bookmarkIdParamSchema = z.object({
  bookmarkId: z.string().min(1),
});

const updateLastReadSchema = z.object({
  surahId: z.coerce.number().int().min(1).max(114),
  ayahNumber: z.coerce.number().int().min(1).optional().default(1),
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
  surahId: z.coerce.number().int().min(1).max(114),
  currentPage: z.coerce.number().int().min(1).max(604),
  pagesRead: z.coerce.number().int().min(1).max(604).optional(),
});

const searchQuranQuerySchema = z.object({
  q: z.string().min(1).max(500),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(20).optional(),
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
 * /quran/bookmarks/{bookmarkId}:
 *   patch:
 *     tags: ['Quran']
 *     summary: تعديل ملاحظة علامة قرآن موجودة
 *     description: تحديث حقل النص الملاحظة (note) لعلامة قرآن موجودة.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: bookmarkId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note: { type: string, maxLength: 500, example: "آية الكرسي - قرأتها بعد صلاة الفجر" }
 *     responses:
 *       200: { description: ✅ تم تحديث الملاحظة }
 *       404: { description: ❌ العلامة غير موجودة أو تنتمي لمستخدم آخر }
 */
quranRouter.patch(
  '/bookmarks/:bookmarkId',
  authenticate,
  validate(bookmarkIdParamSchema, 'params'),
  validate(updateBookmarkSchema),
  updateBookmarkHandler,
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

/**
 * @openapi
 * /quran/juz:
 *   get:
 *     tags: ['Quran']
 *     summary: قائمة الأجزاء الثلاثين للقرآن الكريم (Tab شاشة الاجزاء)
 *     description: |
 *       يعرض 30 جزءاً (الجزء الأول..الجزء الثلاثون) مع الاسم العربي والإنجليزي،
 *       عدد الآيات، الصفحة الأولى والأخيرة، والسورة الاولى داخل كل جزء (عرض بيانات شاشة 2).
 *     responses:
 *       200:
 *         description: ✅ قائمة الأجزاء
 */
quranRouter.get('/juz', listJuzHandler);

/**
 * @openapi
 * /quran/juz/{juzNumber}/surahs:
 *   get:
 *     tags: ['Quran']
 *     summary: سور الجزء المحدد (عند الضغط على جزء في القائمة)
 *     parameters:
 *       - in: path
 *         name: juzNumber
 *         required: true
 *         schema: { type: integer, minimum: 1, maximum: 30, example: 2 }
 *         description: رقم الجزء (1 إلى 30)
 *     responses:
 *       200: { description: ✅ سور الجزء }
 *       400: { description: ❌ رقم جزء غير صالح (1..30) }
 */
quranRouter.get(
  '/juz/:juzNumber/surahs',
  validate(juzNumberParamSchema, 'params'),
  listJuzSurahsHandler,
);

/**
 * @openapi
 * /quran/pages/{pageNumber}:
 *   get:
 *     tags: ['Quran']
 *     summary: صفحة قرآن مادية بالكامل حسب رقم صفحة المصحف (شاشة قارئ القرآن)
 *     description: |
 *       يعرض كل الآيات الموجودة فعلياً في الصفحة المادية رقم pageNumber من مصحف الملك فهد
 *       (إجمالي الصفحات = 604). يستخدم هذا في شاشة القارئ بدلاً من pagination حسب عدد الآيات.
 *     parameters:
 *       - in: path
 *         name: pageNumber
 *         required: true
 *         schema: { type: integer, minimum: 1, maximum: 604, example: 35 }
 *         description: رقم الصفحة في المصحف (1..604)
 *     responses:
 *       200: { description: ✅ محتوى الصفحة (الآيات + السور التي تحتويها) }
 *       400: { description: ❌ رقم صفحة غير صالح (1..604) }
 */
quranRouter.get(
  '/pages/:pageNumber',
  validate(pageNumberParamSchema, 'params'),
  listAyahsByPageHandler,
);

/**
 * @openapi
 * /quran/khatmah/stats:
 *   get:
 *     tags: ['Quran']
 *     summary: بيانات شاشة استكمال الختمة الكاملة (هدف اليوم + ستريك + الإحصائيات)
 *     description: |
 *       المخصص لشاشة "استكمال الختمة": (1) بيانات الختمة الأساسية مثل السورة الحالية والتقدم،
 *       (2) dailyGoal: هدف اليوم (صفحات/5 + ما قرأه اليوم + باقي للهدف)،
 *       (3) stats: عدد الأيام المتتالية للقراءة + عدد الختمات المنتهية + إجمالي الصفحات المقروءة.
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: ✅ بيانات الختمة مع الإحصائيات }
 */
quranRouter.get('/khatmah/stats', authenticate, getKhatmahStatsHandler);

// ============================================================
//  Round 2 NEW ENDPOINTS: Reset Khatmah, Quran Search, Random Ayah
// ============================================================

/**
 * @openapi
 * /quran/khatmah/reset:
 *   post:
 *     tags: ['Quran']
 *     summary: تصفير الختمة وبداية ختمة جديدة (سورة البقرة صفحة 1)
 *     description: |
 *       يستخدم هذا بعد إكمال المستخدم الختمة الحالية وإتمام الصفحة 604،
 *       لبدء ختمة جديدة من الصفر (سورة البقرة صفحة 1 وإجمالي صفحات مقروءة = 0).
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: ✅ تم تصفير الختمة وبداية ختمة جديدة }
 */
quranRouter.post('/khatmah/reset', authenticate, resetKhatmahHandler);

/**
 * @openapi
 * /quran/search:
 *   get:
 *     tags: ['Quran']
 *     summary: بحث نصي في آيات القرآن الكريم (case-insensitive)
 *     description: |
 *       يعيد الآيات التي تحوي عبارة البحث داخل نص الآية بالعربية. كل نتيجة
 *       تشير إلى السورة التابعة لها وصفحة المصحف ورقم الجزء.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 1, maxLength: 500, example: "الرحمن الرحيم" }
 *         description: كلمة أو عبارة البحث داخل نص الآيات
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 200 }
 *     responses:
 *       200: { description: ✅ نتائج البحث (عدد النتائج + الصفحات + الآيات المثراة) }
 *       400: { description: ❌ مطلوب معامل q عبارة البحث (min 1 حرف) }
 */
quranRouter.get('/search', validate(searchQuranQuerySchema, 'query'), searchQuranHandler);

/**
 * @openapi
 * /quran/ayahs/random:
 *   get:
 *     tags: ['Quran']
 *     summary: آية عشوائية من القرآن الكريم مع تفاصيل السورة
 *     description: |
 *       يوفر آية عشوائية لاستخدامها في (آية اليوم، عرض ويدجيت، لعبة تحدي اليوم،
 *       أو اقتباس سريع). يضم تفاصيل السورة ورقم الصفحة والجزء.
 *     responses:
 *       200: { description: ✅ آية عشوائية مع تفاصيل السورة التابعة لها }
 */
quranRouter.get('/ayahs/random', getRandomAyahHandler);

// ============================================================
//  Round 3 NEW ENDPOINTS: Offline Quran Catalog + Juz Ayahs
// ============================================================

/**
 * @openapi
 * /quran/full-catalog:
 *   get:
 *     tags: ['Quran']
 *     summary: كتالوج القرآن الكريم كاملاً (تحميل للقراءة بدون إنترنت)
 *     description: |
 *       يعرض كتالوج القرآن كاملاً (114 سورة + 6236 آية) في payload واحد
 *       لتحميله على الجهاز وتخزينه محلياً لدعم وضع الأوفلاين (Offline Mode).
 *       البيانات معالجة: البسمتلة المكررة مزالة من أول آية كل سورة عدا الفاتحة والتوبة،
 *       ومزالة BOM من كل النصوص، عشان الفلاتر يستخدمها مباشرة في قاعدة البيانات المحلية.
 *       الحجم المتوقع: ~3-4 MB غير مضغوط / ~800 KB مع Gzip/Brotli.
 *     responses:
 *       200:
 *         description: ✅ كتالوج القرآن الكامل جاهز للتحميل
 */
quranRouter.get('/full-catalog', getFullQuranCatalogHandler);

/**
 * @openapi
 * /quran/juz/{juzNumber}/ayahs:
 *   get:
 *     tags: ['Quran']
 *     summary: آيات جزء معين كاملة دفعة واحدة (تحميل جزء بدون إنترنت)
 *     description: |
 *       يعرض كل آيات الجزء المحدد (1 إلى 30) دفعة واحدة لتخزينها محلياً
 *       أو عرضها في شاشة قراءة الجزء بدون طلبات متعددة. الآيات معالجة مثل كتالوج كامل.
 *     parameters:
 *       - in: path
 *         name: juzNumber
 *         required: true
 *         schema: { type: integer, minimum: 1, maximum: 30, example: 1 }
 *         description: رقم الجزء (1..30)
 *     responses:
 *       200: { description: ✅ آيات الجزء كاملة }
 *       400: { description: ❌ رقم جزء غير صالح (1..30) }
 */
quranRouter.get(
  '/juz/:juzNumber/ayahs',
  validate(juzNumberParamSchema, 'params'),
  listAyahsByJuzHandler,
);

// ============================================================
//  Guest Data Merge (Contract §4, §13)
// ============================================================

const importLocalDataSchema = z.object({
  bookmarks: z.array(z.object({
    surahId: z.coerce.number().int().min(1).max(114),
    ayahNumber: z.coerce.number().int().min(1).optional(),
    page: z.coerce.number().int().min(1).max(604).optional(),
    note: z.string().max(500).optional(),
  })).optional(),
  lastRead: z.object({
    surahId: z.coerce.number().int().min(1).max(114),
    page: z.coerce.number().int().min(1).max(604),
    ayahNumber: z.coerce.number().int().min(1).optional(),
  }).optional(),
});

/**
 * @openapi
 * /quran/import-local:
 *   post:
 *     tags: ['Quran']
 *     summary: دمج بيانات القرآن المحلية (Guest → Account)
 *     description: |
 *       يستورد bookmarks و last-read من التطبيق المحلي (Guest) بعد تسجيل الدخول.
 *       يتجنب التكرار — يضيف فقط bookmarks الجديدة ويحدّث last-read فقط إذا لم يكن موجوداً.
 *       **Use case:** عندما يسجل guest دخوله لأول مرة، Flutter يرسل كل البيانات المحلية المحفوظة
 *       في SharedPreferences لدمجها مع حسابه الجديد.
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bookmarks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [surahId]
 *                   properties:
 *                     surahId: { type: integer, minimum: 1, maximum: 114 }
 *                     ayahNumber: { type: integer, minimum: 1 }
 *                     page: { type: integer, minimum: 1, maximum: 604 }
 *                     note: { type: string, maxLength: 500 }
 *               lastRead:
 *                 type: object
 *                 required: [surahId, page]
 *                 properties:
 *                   surahId: { type: integer, minimum: 1, maximum: 114 }
 *                   page: { type: integer, minimum: 1, maximum: 604 }
 *                   ayahNumber: { type: integer, minimum: 1 }
 *           examples:
 *             guestData:
 *               summary: مثال على بيانات guest محلية
 *               value:
 *                 bookmarks:
 *                   - surahId: 2
 *                     ayahNumber: 255
 *                     page: 42
 *                     note: آية الكرسي
 *                   - surahId: 36
 *                     page: 442
 *                 lastRead:
 *                   surahId: 18
 *                   page: 293
 *                   ayahNumber: 1
 *     responses:
 *       200:
 *         description: ✅ تم دمج البيانات المحلية بنجاح
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Imported 2 bookmark(s) and last-read position
 *               data:
 *                 imported:
 *                   bookmarks: 2
 *                   lastRead: true
 *               timestamp: '2026-08-28T12:00:00.000Z'
 *               requestId: uuid
 *       400:
 *         description: ❌ بيانات غير صالحة
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
quranRouter.post(
  '/import-local',
  authenticate,
  validate(importLocalDataSchema),
  importLocalDataHandler,
);

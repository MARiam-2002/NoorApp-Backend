import { Router } from 'express';
import {
  getDailyWirdHandler,
  getDhikrCategoriesHandler,
  getDhikrCategoryByKeyHandler,
  getDhikrHomeHandler,
  getAdhkarProgressHandler,
  saveAdhkarProgressHandler,
  listAdhkarFavoritesHandler,
  addAdhkarFavoriteHandler,
  removeAdhkarFavoriteHandler,
  searchAdhkarHandler,
  saveResumeMarkHandler,
} from '../controllers/adhkar.controller';
import { authenticate } from '../middleware/auth';

export const adhkarRouter = Router();

/**
 * @openapi
 * /adhkar:
 *   get:
 *     tags: ['Adhkar (الأذكار)']
 *     summary: الشاشة الرئيسية للأذكار (ورد اليوم + 6 فئات)
 *     description: >
 *       يُرجع ورد اليوم مع نسبة التقدم (Progress bar) + قائمة كل الفئات الست
 *       (الصباح، المساء، النوم، المسجد، الصلاة، ورد اليوم) للعرض في الشاشة الأولى من تبويب الأذكار.
 *       المحتوى مصدره حصن المسلم + صحيح البخاري ومسلم.
 *     responses:
 *       200:
 *         description: ✅ ورد اليوم + قائمة الفئات
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Dhikr home (categories + daily wird) retrieved successfully
 *               data:
 *                 greeting: واذكر ربك إذا نسيت
 *                 dailyWird:
 *                   titleAr: وردك اليوم
 *                   subtitleAr: واذكر ربك إذا نسيت
 *                   progressItemsDone: 4
 *                   progressItemsTotal: 8
 *                   progressPercent: 50
 *                   ctaAr: اكمل وردك اليوم
 *                   categoryKey: GENERAL_WIRD
 *                   items:
 *                     - id: uuid
 *                       orderInCategory: 1
 *                       textAr: لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ
 *                       repeatCount: 100
 *                       referenceAr: رواه البخاري ومسلم
 *                       benefitAr: كنز من كنوز الجنة، ومفتاح لكل باب خير
 *                 categories:
 *                   - id: cat-uuid-1
 *                     key: MORNING
 *                     nameAr: اذكار الصباح
 *                     nameEn: Morning Dhikr
 *                     descriptionAr: الأذكار الواردة لصباح المسلم كل يوم من حصن المسلم
 *                     iconCode: 🌤️
 *                     sortOrder: 1
 *                     totalItems: 12
 *                   - id: cat-uuid-2
 *                     key: EVENING
 *                     nameAr: اذكار المساء
 *                     nameEn: Evening Dhikr
 *                     iconCode: 🌙
 *                     sortOrder: 2
 *                     totalItems: 11
 *               meta: null
 *               timestamp: '2026-08-27T03:15:00.000Z'
 *               requestId: uuid
 */
adhkarRouter.get('/', getDhikrHomeHandler);

/**
 * @openapi
 * /adhkar/categories:
 *   get:
 *     tags: ['Adhkar (الأذكار)']
 *     summary: قائمة الفئات فقط (بدون ورد اليوم)
 *     description: قائمة الـ 6 فئات للأذكار فقط بدون بيانات ورد اليوم.
 *     responses:
 *       200:
 *         description: ✅ قائمة الفئات
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Dhikr categories retrieved successfully
 *               data:
 *                 - id: cat-uuid-morning
 *                   key: MORNING
 *                   nameAr: اذكار الصباح
 *                   nameEn: Morning Dhikr
 *                   descriptionAr: الأذكار الواردة لصباح المسلم
 *                   iconCode: 🌤️
 *                   sortOrder: 1
 *                   totalItems: 12
 *               meta: null
 *               timestamp: '2026-08-27T03:15:00.000Z'
 *               requestId: uuid
 */
adhkarRouter.get('/categories', getDhikrCategoriesHandler);

/**
 * @openapi
 * /adhkar/daily-wird:
 *   get:
 *     tags: ['Adhkar (الأذكار)']
 *     summary: تفاصيل ورد اليوم فقط
 *     description: كروت الأذكار داخل "وردك اليوم" مع تكرار كل ذكر والمرجع والفضل والزر "مشاركة" لكل ذكر.
 *     responses:
 *       200:
 *         description: ✅ تفاصيل ورد اليوم
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Daily wird (ورد اليوم) retrieved successfully
 *               data:
 *                 titleAr: وردك اليوم
 *                 subtitleAr: واذكر ربك إذا نسيت
 *                 progressItemsDone: 4
 *                 progressItemsTotal: 8
 *                 progressPercent: 50
 *                 ctaAr: اكمل وردك اليوم
 *                 categoryKey: GENERAL_WIRD
 *                 items:
 *                   - id: uuid-1
 *                     orderInCategory: 1
 *                     textAr: لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ
 *                     repeatCount: 100
 *                     referenceAr: رواه البخاري ومسلم
 *                     benefitAr: كنز من كنوز الجنة
 *               meta: null
 *               timestamp: '2026-08-27T03:15:00.000Z'
 *               requestId: uuid
 */
adhkarRouter.get('/daily-wird', getDailyWirdHandler);

/**
 * @openapi
 * /adhkar/progress:
 *   get:
 *     tags: ['Adhkar (الأذكار)']
 *     summary: تقدم المستخدم في فئة أذكار معينة لليوم
 *     description: يُرجع حالة كل ذكر (tapCount + completed) + markedItemId للاستكمال.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: categoryKey
 *         schema: { type: string, example: MORNING }
 *         description: مفتاح الفئة (MORNING, EVENING, BEFORE_SLEEP, ...)
 *     responses:
 *       200:
 *         description: ✅ تقدم الأذكار
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 categoryKey: MORNING
 *                 markedItemId: item-uuid
 *                 items:
 *                   - itemId: item-uuid
 *                     tapCount: 2
 *                     completed: false
 *                 progressItemsDone: 3
 *                 progressItemsTotal: 20
 *                 progressPercent: 15
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
adhkarRouter.get('/progress', authenticate, getAdhkarProgressHandler);

/**
 * @openapi
 * /adhkar/progress:
 *   put:
 *     tags: ['Adhkar (الأذكار)']
 *     summary: حفظ تقدم ذكر معين (tap count)
 *     description: يحفظ عدد النقرات لذكر معين لليوم الحالي ويُرجع التقدم الكامل.
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoryKey, itemId, tapCount]
 *             properties:
 *               categoryKey: { type: string, example: MORNING }
 *               itemId: { type: string, example: item-uuid }
 *               tapCount: { type: integer, example: 3 }
 *     responses:
 *       200:
 *         description: ✅ تم حفظ التقدم
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
adhkarRouter.put('/progress', authenticate, saveAdhkarProgressHandler);

/**
 * @openapi
 * /adhkar/categories/{key}:
 *   get:
 *     tags: ['Adhkar (الأذكار)']
 *     summary: تفاصيل فئة معينة + كل الأذكار فيها (مثلاً اذكار الصباح مفصلين)
 *     description: >
 *       يُرجع الفئة + قائمة الأذكار داخلها بالترتيب، مع نص الذكر بالتشكيل الكامل
 *       وعدد مرات التكرار (التكرار) + المرجع (رواه البخاري) + فضل الذكر (إن وجد)
 *       — كل الأزرار "مشاركة" في الشاشة التانية تعتمد على (textAr + repeatCount + referenceAr).
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *           enum: [MORNING, EVENING, BEFORE_SLEEP, ENTERING_MOSQUE, AFTER_PRAYER, GENERAL_WIRD, TRAVEL, SICK, FOOD, ISTIKHARA, WUDU, ISTIGHFAR, QAYN, MASJID_AFTER_SALAM]
 *           example: MORNING
 *         description: مفتاح الفئة (حرف كبير أو صغير - الـ backend يحول لحروف كبير)
 *     responses:
 *       200:
 *         description: ✅ تفاصيل الفئة مع الأذكار
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Dhikr category MORNING retrieved successfully
 *               data:
 *                 id: cat-uuid-morning
 *                 key: MORNING
 *                 nameAr: اذكار الصباح
 *                 nameEn: Morning Dhikr
 *                 descriptionAr: الأذكار الواردة لصباح المسلم كل يوم من حصن المسلم
 *                 iconCode: 🌤️
 *                 sortOrder: 1
 *                 totalItems: 3
 *                 items:
 *                   - id: item-uuid-1
 *                     orderInCategory: 1
 *                     textAr: >
 *                       أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ. اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ...
 *                     repeatCount: 1
 *                     referenceAr: آية الكرسي - سورة البقرة 255
 *                     benefitAr: من قالها حين يصبح أجير من الجن حتى يمسي
 *                   - id: item-uuid-2
 *                     orderInCategory: 2
 *                     textAr: قُلْ هُوَ ٱللَّهُ أَحَدٌ ... (المعوذات)
 *                     repeatCount: 3
 *                     referenceAr: المعوذات ثلاث
 *                     benefitAr: من قرأهن ثلاثاً كفتاه من كل شيء
 *               meta: null
 *               timestamp: '2026-08-27T03:15:00.000Z'
 *               requestId: uuid
 *       404:
 *         description: ❌ الفئة غير موجودة
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: Dhikr category not found for key: XYZ
 *               code: NOT_FOUND
 *               timestamp: '2026-08-27T03:15:00.000Z'
 */
adhkarRouter.get('/categories/:key', getDhikrCategoryByKeyHandler);


/**
 * @openapi
 * /adhkar/favorites:
 *   get:
 *     tags: ['Adhkar (الأذكار)']
 *     summary: قائمة الأذكار المفضلة للمستخدم
 *     description: يُرجع كل الأذكار التي حفظها المستخدم في المفضلة مع تفاصيل كل ذكر.
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: ✅ قائمة المفضلة
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Adhkar favorites retrieved successfully
 *               data:
 *                 - id: fav-uuid
 *                   itemId: item-uuid
 *                   dhikr:
 *                     id: item-uuid
 *                     textAr: لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ
 *                     repeatCount: 100
 *                     referenceAr: رواه البخاري
 *                     benefitAr: كنز من كنوز الجنة
 *                     category:
 *                       key: MORNING
 *                       nameAr: اذكار الصباح
 *                   createdAt: '2026-08-28T10:00:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
adhkarRouter.get('/favorites', authenticate, listAdhkarFavoritesHandler);

/**
 * @openapi
 * /adhkar/favorites:
 *   post:
 *     tags: ['Adhkar (الأذكار)']
 *     summary: إضافة ذكر للمفضلة
 *     description: حفظ ذكر معين في قائمة المفضلة للمستخدم.
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [itemId]
 *             properties:
 *               itemId: { type: string, example: item-uuid }
 *     responses:
 *       201:
 *         description: ✅ تمت الإضافة للمفضلة
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Dhikr added to favorites
 *               data:
 *                 id: fav-uuid
 *                 itemId: item-uuid
 *                 dhikr:
 *                   id: item-uuid
 *                   textAr: لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ
 *                   repeatCount: 100
 *                   referenceAr: رواه البخاري
 *                   category:
 *                     key: MORNING
 *                     nameAr: اذكار الصباح
 *                 createdAt: '2026-08-28T10:00:00.000Z'
 *       409:
 *         description: ❌ الذكر موجود في المفضلة
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
adhkarRouter.post('/favorites', authenticate, addAdhkarFavoriteHandler);

/**
 * @openapi
 * /adhkar/favorites/{favoriteId}:
 *   delete:
 *     tags: ['Adhkar (الأذكار)']
 *     summary: إزالة ذكر من المفضلة
 *     description: حذف ذكر من قائمة المفضلة.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: favoriteId
 *         required: true
 *         schema: { type: string }
 *         description: معرف المفضلة (favorite ID)
 *     responses:
 *       200:
 *         description: ✅ تمت الإزالة
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Favorite removed successfully
 *               data:
 *                 message: Favorite removed successfully
 *       404:
 *         description: ❌ المفضلة غير موجودة
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
/**
 * @openapi
 * /adhkar/search:
 *   get:
 *     tags: ['Adhkar (الأذكار)']
 *     summary: بحث شامل داخل كل الأذكار (كل الفئات + الورد اليومي) - تشكيل عربي insensitive
 *     description: >
 *       يبحث في نص الأذكار (textAr مع/بدون تشكيل) و المراجع (referenceAr) و الفضل (benefitAr)
 *       و أسماء الفئات. يدعم فلترة بفئة واحدة عبر categoryKey، و تحديد عدد النتائج عبر limit.
 *       البحث يعمل على بيانات قاعدة البيانات أولاً ثم fallback على hardcoded الأذكار
 *       إذا كانت القاعدة فاضية أو الجدول ما موجودش بعد.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, example: 'اللهم بِكَ أَصْبَحْنَا' }
 *         description: نص البحث (سواء عربي تشكيل أو بدون تشكيل أو إنجليزي)
 *       - in: query
 *         name: categoryKey
 *         required: false
 *         schema:
 *           type: string
 *           enum: [MORNING, EVENING, BEFORE_SLEEP, ENTERING_MOSQUE, AFTER_PRAYER, GENERAL_WIRD, TRAVEL, SICK, FOOD, ISTIKHARA, WUDU, ISTIGHFAR, QAYN, MASJID_AFTER_SALAM]
 *         description: (اختياري) فلترة البحث داخل فئة معينة بس
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, default: 50, minimum: 1, maximum: 100, example: 20 }
 *         description: (اختياري) أقصى عدد نتيجة
 *     responses:
 *       200:
 *         description: ✅ نتائج البحث (مرتبة حسب matchScore)
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: 'Adhkar search results for "أصبحنا" retrieved successfully'
 *               data:
 *                 query: أصبحنا
 *                 total: 4
 *                 limit: 50
 *                 items:
 *                   - id: fb-m-3
 *                     categoryKey: MORNING
 *                     categoryNameAr: اذكار الصباح
 *                     categoryNameEn: Morning Dhikr
 *                     orderInCategory: 3
 *                     textAr: أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ...
 *                     repeatCount: 1
 *                     referenceAr: رواه مسلم
 *                     benefitAr: من قالها حين يصبح أجير من الجن حتى يمسي
 *                     matchScore: 180
 *               meta: {}
 *               timestamp: '2026-08-29T09:30:00.000Z'
 */
adhkarRouter.get('/search', searchAdhkarHandler);

adhkarRouter.delete('/favorites/:favoriteId', authenticate, removeAdhkarFavoriteHandler);


/**
 * @openapi
 * /adhkar/resume-mark:
 *   put:
 *     tags: ['Adhkar (الأذكار)']
 *     summary: حفظ مكان الوقف (Resume Mark) لفئة أذكار معينة
 *     description: >
 *       يحفظ آخر ذكر وصل إليه المستخدم في فئة معينة، ليتم استئناف القراءة من نفس المكان
 *       على كل الأجهزة. يتم الحفظ per-user per-category.
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoryKey, markedItemId]
 *             properties:
 *               categoryKey:
 *                 type: string
 *                 enum: [MORNING, EVENING, BEFORE_SLEEP, ENTERING_MOSQUE, AFTER_PRAYER, GENERAL_WIRD]
 *                 example: MORNING
 *               markedItemId:
 *                 type: string
 *                 example: uuid-of-dhikr-item
 *     responses:
 *       200:
 *         description: ✅ تم حفظ مكان الوقف
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Resume mark saved successfully
 *               data:
 *                 markedItemId: uuid-of-dhikr-item
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
adhkarRouter.put('/resume-mark', authenticate, saveResumeMarkHandler);

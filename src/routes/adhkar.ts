import { Router } from 'express';
import {
  getDailyWirdHandler,
  getDhikrCategoriesHandler,
  getDhikrCategoryByKeyHandler,
  getDhikrHomeHandler,
} from '../controllers/adhkar.controller';

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
 *           enum: [MORNING, EVENING, BEFORE_SLEEP, ENTERING_MOSQUE, AFTER_PRAYER, GENERAL_WIRD]
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

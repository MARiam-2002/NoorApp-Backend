import { Router } from 'express';

import { authenticate } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboard.controller';

/**
 * @openapi
 * /dashboard:
 *   get:
 *     tags: ['Dashboard']
 *     summary: الشاشة الرئيسية (كل البيانات في طلب واحد)
 *     description: |
 *       الطلب الأهم للـ Flutter - استدعاء واحد فقط عند فتح التطبيق.
 *       يحتوي على:
 *       - التحية + النقاط
 *       - أوقات الصلاة + العداد التنازلي للصلاة القادمة
 *       - آية اليوم
 *       - حديث اليوم
 *       - رحلتك اليومية: الصلاة + القرآن + الذكار + الصدقة
 *       - استكمال الختمة (السورة الحالية + التقدم)
 *       - تحدي اليوم + حالة إنجازه + استلام المكافأة
 *       - أدوات سريعة (المسبحة + القبلة)
 *       للتحديثات الجزئية بعد فعل المستخدم، استخدم endpoints الدقيقة في كل module.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: بيانات الشاشة الرئيسية
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DashboardResponse'
 *             example:
 *               success: true
 *               message: بيانات الشاشة الرئيسية
 *               data:
 *                 greeting:
 *                   text: صباح الخير، مريم 🌸
 *                   points: 2450
 *                   level: 5
 *                   streakDays: 12
 *                 prayers:
 *                   date: '2026-07-27'
 *                   currentPrayer: DHUHR
 *                   nextPrayer: ASR
 *                   nextPrayerAt: '2026-07-27T15:24:00.000Z'
 *                   countdownSeconds: 5830
 *                   list:
 *                     - id: FAJR
 *                       nameAr: الفجر
 *                       time: '03:42'
 *                       completed: true
 *                     - id: DHUHR
 *                       nameAr: الظهر
 *                       time: '12:30'
 *                       completed: true
 *                     - id: ASR
 *                       nameAr: العصر
 *                       time: '15:24'
 *                       completed: false
 *                     - id: MAGHRIB
 *                       nameAr: المغرب
 *                       time: '18:49'
 *                       completed: false
 *                     - id: ISHA
 *                       nameAr: العشاء
 *                       time: '20:18'
 *                       completed: false
 *                 verseOfDay:
 *                   surahNumber: 2
 *                   surahNameAr: البقرة
 *                   verseNumber: 255
 *                   text: اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ
 *                   translation: الله - لا إله إلا هو، الحي القيوم. لا تأخذه سنة ولا نوم. له ما في السماوات وما في الأرض
 *                 hadithOfDay:
 *                   narrator: عن أبي هريرة رضي الله عنه
 *                   text: من سلك طريقاً يلتمس فيه علماً سهّل الله له به طريقاً إلى الجنة، وإن الملائكة لتضع أجنحتها لطالب العلم رضا بما يصنع
 *                   source: صحيح مسلم
 *                 journeyToday:
 *                   quranPages: 3
 *                   quranGoal: 4
 *                   adhkarCompleted: false
 *                   sadaqahAmount: 25
 *                   prayersCompleted: 3
 *                   overallPercent: 68.5
 *                 khatmahProgress:
 *                   currentSurah: النحل
 *                   currentPage: 278
 *                   totalPages: 604
 *                   percent: 46.03
 *                 todayChallenge:
 *                   id: 208
 *                   titleAr: اقرأ صفحتين من القرآن
 *                   descriptionAr: اقرأ صفحتين على الأقل من القرآن الكريم اليوم
 *                   type: QURAN_PAGES
 *                   target: 2
 *                   currentValue: 3
 *                   completed: true
 *                   rewardPoints: 50
 *                   claimed: false
 *                 quickTools:
 *                   - key: TASBIH
 *                     labelAr: المسبحة
 *                   - key: QIBLA
 *                     labelAr: القبلة
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         description: ❌ التوكن غير صالح أو منتهي
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: UNAUTHORIZED
 *               message: التوكن غير صالح أو منتهي الصلاحية
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 */
export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  authenticate,
  dashboardController.getDashboard,
);

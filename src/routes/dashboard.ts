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
 *       - التحية + النقاط + اسم اليوم + التاريخ الهجري
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
 *               message: 'بيانات الشاشة الرئيسية'
 *               data:
 *                 greeting:
 *                   displayName: 'أحمد محمد علي'
 *                   fullName: 'أحمد محمد علي'
 *                   username: 'ahmed_mohamed_8472'
 *                   points: 2450
 *                   weekdayName: 'السبت'
 *                   hijriDate: '15 ذو القعدة 1447'
 *                   gregorianDate: '28 يوليو 2026'
 *                 prayers:
 *                   date: '2026-07-28'
 *                   timezone: 'Africa/Cairo'
 *                   nextPrayer:
 *                     name: 'Asr'
 *                     nameAr: 'العصر'
 *                     time: '15:24'
 *                     countdownSeconds: 4468
 *                   schedule:
 *                     - name: 'Fajr'
 *                       nameAr: 'الفجر'
 *                       time: '04:11'
 *                       completed: true
 *                     - name: 'Dhuhr'
 *                       nameAr: 'الظهر'
 *                       time: '12:58'
 *                       completed: true
 *                     - name: 'Asr'
 *                       nameAr: 'العصر'
 *                       time: '15:24'
 *                       completed: false
 *                     - name: 'Maghrib'
 *                       nameAr: 'المغرب'
 *                       time: '18:49'
 *                       completed: false
 *                     - name: 'Isha'
 *                       nameAr: 'العشاء'
 *                       time: '20:18'
 *                       completed: false
 *                   completedCount: 2
 *                   totalCount: 5
 *                 verseOfTheDay:
 *                   textAr: 'الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ'
 *                   referenceAr: '[ الرعد: 28 ]'
 *                   surahNumber: 13
 *                   ayahNumber: 28
 *                 hadithOfTheDay:
 *                   textAr: 'المؤمن للمؤمن كالبنيان يشد بعضه بعضاً'
 *                   sourceAr: '[ متفق عليه ]'
 *                 dailyJourney:
 *                   prayer:
 *                     completed: 2
 *                     total: 5
 *                     progress: 0.4
 *                   quran:
 *                     pagesRead: 4
 *                   adhkar:
 *                     completed: true
 *                   sadaqah:
 *                     amount: 25
 *                 khatmah:
 *                   surahId: 2
 *                   surahNameEn: 'Al-Baqarah'
 *                   surahNameAr: 'البقرة'
 *                   currentPage: 35
 *                   progressPercent: 6
 *                 dailyChallenge:
 *                   titleAr: 'اقرأ 5 صفحات من القرآن'
 *                   descriptionAr: 'اقرأ 5 صفحات من القرآن الكريم اليوم للحصول على 50 نقطة'
 *                   rewardPoints: 50
 *                   targetValue: 5
 *                   completed: false
 *                   claimed: false
 *                 utilities:
 *                   tasbih:
 *                     enabled: true
 *                   qibla:
 *                     enabled: true
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         description: ❌ التوكن غير صالح أو منتهي
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: UNAUTHORIZED
 *               message: 'التوكن غير صالح أو منتهي الصلاحية'
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 */
export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  authenticate,
  dashboardController.getDashboard,
);

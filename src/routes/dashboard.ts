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
 *       401:
 *         description: ❌ التوكن غير صالح أو منتهي
 */
export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  authenticate,
  dashboardController.getDashboard,
);

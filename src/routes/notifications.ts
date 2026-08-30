import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  deleteNotificationHandler,
  getNotificationHandler,
  getUnreadCountHandler,
  listNotificationsHandler,
  markAllAsReadHandler,
  markAsReadHandler,
} from '../controllers/notification.controller';

export const notificationsRouter = Router();

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: ['Notifications']
 *     summary: قائمة إشعارات المستخدم (مصفاة بترقيم الصفحات)
 *     description: كل الإشعارات مع حالتها (مقروء / غير مقروء). رمز أيقونة الجرس في الشاشة الرئيسية.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, example: 1 }
 *         description: رقم الصفحة (افتراضي 1)
 *       - in: query
 *         name: perPage
 *         schema: { type: integer, default: 20, minimum: 5, maximum: 100, example: 20 }
 *         description: عدد الإشعارات في الصفحة (افتراضي 20)
 *     responses:
 *       200:
 *         description: ✅ قائمة الإشعارات
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: قائمة الإشعارات
 *               data:
 *                 - id: 550e8400-e29b-41d4-a716-446655440000
 *                   type: CHALLENGE
 *                   titleAr: مبروك! حصلت على مكافأة التحدي
 *                   titleEn: Congratulations! You earned the challenge reward
 *                   bodyAr: أكملت تحدي اليوم وحصلت على 50 نقطة
 *                   bodyEn: You completed today's challenge and earned 50 points
 *                   read: false
 *                   isRead: false
 *                   deepLink: /challenges
 *                   payload:
 *                     challengeId: '208'
 *                     points: 50
 *                   createdAt: '2026-07-27T09:15:00.000Z'
 *                 - id: 550e8400-e29b-41d4-a716-446655440001
 *                   type: AZAN
 *                   titleAr: حان وقت صلاة الظهر
 *                   titleEn: It's time for Dhuhr prayer
 *                   bodyAr: اقضِ صلاتك الآن واحرص على الصلاة في وقتها
 *                   bodyEn: Pray now and make sure to pray on time
 *                   read: true
 *                   isRead: true
 *                   readAt: '2026-07-27T05:35:00.000Z'
 *                   deepLink: /prayers
 *                   createdAt: '2026-07-27T05:30:00.000Z'
 *                 - id: 550e8400-e29b-41d4-a716-446655440002
 *                   type: SYSTEM
 *                   titleAr: آية اليوم جاهزة
 *                   titleEn: Verse of the Day is ready
 *                   bodyAr: 'اقرأ آية اليوم: آية الكرسي من سورة البقرة'
 *                   bodyEn: 'Read today''s verse: Ayatul Kursi from Surah Al-Baqarah'
 *                   read: true
 *                   isRead: true
 *                   deepLink: /content/verse-of-day
 *                   createdAt: '2026-07-27T03:00:00.000Z'
 *               meta:
 *                 page: 1
 *                 perPage: 20
 *                 total: 45
 *                 unreadCount: 7
 *                 totalPages: 3
 *                 hasNext: true
 *                 hasPrev: false
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
notificationsRouter.get('/', authenticate, listNotificationsHandler);

/**
 * @openapi
 * /notifications/unread-count:
 *   get:
 *     tags: ['Notifications']
 *     summary: عدد الإشعارات غير المقروءة (للـ Badge على أيقونة الجرس)
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: ✅ عدد الإشعارات
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: عدد الإشعارات غير المقروءة
 *               data:
 *                 unreadCount: 7
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
notificationsRouter.get('/unread-count', authenticate, getUnreadCountHandler);

/**
 * @openapi
 * /notifications/{id}/read:
 *   patch:
 *     tags: ['Notifications']
 *     summary: تعليم إشعار واحد على أنه مقروء
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid, example: 550e8400-e29b-41d4-a716-446655440000 }
 *         description: معرف الإشعار (UUID)
 *     responses:
 *       200:
 *         description: ✅ تم التعليم كمقروء
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم تعليم الإشعار كمقروء
 *               data:
 *                 id: 550e8400-e29b-41d4-a716-446655440000
 *                 isRead: true
 *                 unreadCount: 6
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       404:
 *         description: ❌ الإشعار غير موجود
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: NOT_FOUND
 *               message: الإشعار غير موجود
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
notificationsRouter.patch('/:id/read', authenticate, markAsReadHandler);

/**
 * @openapi
 * /notifications/read-all:
 *   post:
 *     tags: ['Notifications']
 *     summary: تعليم جميع الإشعارات كمقروءة دفعة واحدة
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: ✅ تم تعليم جميع الإشعارات كمقروءة
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم تعليم جميع الإشعارات كمقروءة
 *               data:
 *                 markedCount: 7
 *                 unreadCount: 0
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
notificationsRouter.post('/read-all', authenticate, markAllAsReadHandler);

/**
 * @openapi
 * /notifications/{id}:
 *   get:
 *     tags: ['Notifications']
 *     summary: جلب تفاصيل إشعار معين
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid, example: 550e8400-e29b-41d4-a716-446655440000 }
 *         description: معرف الإشعار (UUID)
 *     responses:
 *       200:
 *         description: ✅ تفاصيل الإشعار
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تفاصيل الإشعار
 *               data:
 *                 id: 550e8400-e29b-41d4-a716-446655440000
 *                 type: CHALLENGE_REWARD
 *                 titleAr: مبروك! حصلت على مكافأة التحدي
 *                 bodyAr: أكملت تحدي اليوم وحصلت على 50 نقطة
 *                 isRead: false
 *                 deepLink: /challenges
 *                 payload:
 *                   challengeId: 208
 *                   points: 50
 *                 createdAt: '2026-07-27T09:15:00.000Z'
 *                 readAt: null
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       404:
 *         description: ❌ الإشعار غير موجود
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: NOT_FOUND
 *               message: الإشعار غير موجود
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *   delete:
 *     tags: ['Notifications']
 *     summary: حذف إشعار معين
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid, example: 550e8400-e29b-41d4-a716-446655440000 }
 *         description: معرف الإشعار (UUID)
 *     responses:
 *       204:
 *         description: ✅ تم الحذف
 *       404:
 *         description: ❌ الإشعار غير موجود
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: NOT_FOUND
 *               message: الإشعار غير موجود
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
notificationsRouter.get('/:id', authenticate, getNotificationHandler);
notificationsRouter.delete('/:id', authenticate, deleteNotificationHandler);

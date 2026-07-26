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
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: perPage
 *         schema: { type: integer, default: 20, minimum: 5, maximum: 100 }
 *     responses:
 *       200:
 *         description: ✅ قائمة الإشعارات
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
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: ✅ تم التعليم كمقروء }
 *       404: { description: ❌ الإشعار غير موجود }
 */
notificationsRouter.patch('/:id/read', authenticate, markAsReadHandler);

/**
 * @openapi
 * /notifications/read-all:
 *   patch:
 *     tags: ['Notifications']
 *     summary: تعليم جميع الإشعارات كمقروءة دفعة واحدة
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: ✅ تم تعليم جميع الإشعارات كمقروءة }
 */
notificationsRouter.patch('/read-all', authenticate, markAllAsReadHandler);

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
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: ✅ تفاصيل الإشعار }
 *       404: { description: ❌ الإشعار غير موجود }
 *   delete:
 *     tags: ['Notifications']
 *     summary: حذف إشعار معين
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: ✅ تم الحذف }
 *       404: { description: ❌ الإشعار غير موجود }
 */
notificationsRouter.get('/:id', authenticate, getNotificationHandler);
notificationsRouter.delete('/:id', authenticate, deleteNotificationHandler);

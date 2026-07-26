"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const notification_controller_1 = require("../controllers/notification.controller");
exports.notificationsRouter = (0, express_1.Router)();
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
exports.notificationsRouter.get('/', auth_1.authenticate, notification_controller_1.listNotificationsHandler);
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
exports.notificationsRouter.get('/unread-count', auth_1.authenticate, notification_controller_1.getUnreadCountHandler);
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
exports.notificationsRouter.patch('/:id/read', auth_1.authenticate, notification_controller_1.markAsReadHandler);
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
exports.notificationsRouter.patch('/read-all', auth_1.authenticate, notification_controller_1.markAllAsReadHandler);
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
exports.notificationsRouter.get('/:id', auth_1.authenticate, notification_controller_1.getNotificationHandler);
exports.notificationsRouter.delete('/:id', auth_1.authenticate, notification_controller_1.deleteNotificationHandler);
//# sourceMappingURL=notifications.js.map
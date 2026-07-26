"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationHandler = exports.deleteNotificationHandler = exports.markAllAsReadHandler = exports.markAsReadHandler = exports.getUnreadCountHandler = exports.listNotificationsHandler = void 0;
const config_1 = require("../config");
const errors_1 = require("../lib/errors");
const common_1 = require("../middleware/common");
const notification_service_1 = require("../services/notification.service");
function sendSuccess(res, data, message, statusCode = config_1.HttpStatus.OK, meta) {
    return res.status(statusCode).json((0, common_1.successResponse)(message, data, meta));
}
exports.listNotificationsHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const { page, perPage } = req.query;
    const result = await (0, notification_service_1.listNotifications)(userId, page, perPage);
    sendSuccess(res, result.data, 'Notifications retrieved successfully', config_1.HttpStatus.OK, result.meta);
});
exports.getUnreadCountHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const data = await (0, notification_service_1.getUnreadCount)(userId);
    sendSuccess(res, data, 'Unread count retrieved successfully');
});
exports.markAsReadHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const { id } = req.params;
    const data = await (0, notification_service_1.markAsRead)(userId, id);
    sendSuccess(res, data, 'Notification marked as read successfully');
});
exports.markAllAsReadHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const data = await (0, notification_service_1.markAllAsRead)(userId);
    sendSuccess(res, data, 'All notifications marked as read successfully');
});
exports.deleteNotificationHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const { id } = req.params;
    await (0, notification_service_1.deleteNotification)(userId, id);
    res.status(config_1.HttpStatus.NO_CONTENT).send();
});
exports.getNotificationHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const { id } = req.params;
    const data = await (0, notification_service_1.getNotification)(userId, id);
    sendSuccess(res, data, 'Notification retrieved successfully');
});
//# sourceMappingURL=notification.controller.js.map
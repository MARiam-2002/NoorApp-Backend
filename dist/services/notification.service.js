"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listNotifications = listNotifications;
exports.getUnreadCount = getUnreadCount;
exports.markAsRead = markAsRead;
exports.markAllAsRead = markAllAsRead;
exports.deleteNotification = deleteNotification;
exports.getNotification = getNotification;
const config_1 = require("../config");
const errors_1 = require("../lib/errors");
const prisma_1 = require("../lib/prisma");
const pagination_1 = require("../utils/pagination");
async function listNotifications(userId, page, perPage) {
    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedPerPage = Math.min(100, Math.max(5, Number(perPage) || 20));
    const offset = (parsedPage - 1) * parsedPerPage;
    const [data, total] = await Promise.all([
        prisma_1.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: parsedPerPage,
            skip: offset,
        }),
        prisma_1.prisma.notification.count({ where: { userId } }),
    ]);
    const meta = (0, pagination_1.buildPaginationMeta)(parsedPage, parsedPerPage, total);
    return { data, meta };
}
async function getUnreadCount(userId) {
    const unreadCount = await prisma_1.prisma.notification.count({
        where: { userId, readAt: null },
    });
    return { unreadCount };
}
async function markAsRead(userId, id) {
    const notification = await prisma_1.prisma.notification.findFirst({
        where: { id, userId },
    });
    if (!notification) {
        throw new errors_1.AppError('Notification not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    await prisma_1.prisma.notification.updateMany({
        where: { id, userId, readAt: null },
        data: { readAt: new Date() },
    });
    return prisma_1.prisma.notification.findFirst({ where: { id, userId } });
}
async function markAllAsRead(userId) {
    const result = await prisma_1.prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
    });
    return { markedCount: result.count };
}
async function deleteNotification(userId, id) {
    const notification = await prisma_1.prisma.notification.findFirst({
        where: { id, userId },
    });
    if (!notification) {
        throw new errors_1.AppError('Notification not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    await prisma_1.prisma.notification.deleteMany({ where: { id, userId } });
    return null;
}
async function getNotification(userId, id) {
    const notification = await prisma_1.prisma.notification.findFirst({
        where: { id, userId },
    });
    if (!notification) {
        throw new errors_1.AppError('Notification not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    return notification;
}
//# sourceMappingURL=notification.service.js.map
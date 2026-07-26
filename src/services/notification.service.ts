import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { buildPaginationMeta, parsePaginationQuery } from '../utils/pagination';

export async function listNotifications(
  userId: string,
  page: number,
  perPage: number,
) {
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedPerPage = Math.min(100, Math.max(5, Number(perPage) || 20));
  const offset = (parsedPage - 1) * parsedPerPage;

  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: parsedPerPage,
      skip: offset,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  const meta = buildPaginationMeta(parsedPage, parsedPerPage, total);
  return { data, meta };
}

export async function getUnreadCount(userId: string) {
  const unreadCount = await prisma.notification.count({
    where: { userId, readAt: null },
  });
  return { unreadCount };
}

export async function markAsRead(userId: string, id: string) {
  const notification = await prisma.notification.findFirst({
    where: { id, userId },
  });

  if (!notification) {
    throw new AppError(
      'Notification not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });

  return prisma.notification.findFirst({ where: { id, userId } });
}

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { markedCount: result.count };
}

export async function deleteNotification(userId: string, id: string) {
  const notification = await prisma.notification.findFirst({
    where: { id, userId },
  });

  if (!notification) {
    throw new AppError(
      'Notification not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  await prisma.notification.deleteMany({ where: { id, userId } });
  return null;
}

export async function getNotification(userId: string, id: string) {
  const notification = await prisma.notification.findFirst({
    where: { id, userId },
  });

  if (!notification) {
    throw new AppError(
      'Notification not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  return notification;
}

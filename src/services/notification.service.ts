import { Prisma } from '@prisma/client';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { buildPaginationMeta, parsePaginationQuery } from '../utils/pagination';

export type ContractNotification = {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  type: string;
  read: boolean;
  isRead?: boolean;
  readAt?: string | null;
  deepLink?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
  unreadCount?: number;
};

function mapNotificationTypeToContract(prismaType: string): string {
  const typeUpper = String(prismaType || 'GENERAL').toUpperCase();
  switch (typeUpper) {
    case 'PRAYER_REMINDER':
    case 'AZAN':
      return 'AZAN';
    case 'CHALLENGE':
    case 'CHALLENGE_REWARD':
      return 'CHALLENGE';
    case 'GENERAL':
    case 'SYSTEM':
    case 'ACHIEVEMENT':
    default:
      return 'SYSTEM';
  }
}

function serializeNotification(
  row: {
    id: string;
    userId: string;
    titleAr: string;
    titleEn?: string | null;
    bodyAr: string;
    bodyEn?: string | null;
    type: string;
    readAt: Date | null;
    deepLink?: string | null;
    payload?: Record<string, unknown> | Prisma.JsonValue | null;
    createdAt: Date;
  },
  extra?: Record<string, unknown>,
): ContractNotification {
  const contractType = mapNotificationTypeToContract(String(row.type || 'GENERAL'));
  const isRead = row.readAt != null;
  const rowPayload = row.payload as Record<string, unknown> | null | undefined;
  return {
    id: row.id,
    titleAr: row.titleAr,
    titleEn: (row.titleEn ?? (extra?.titleEn as string | undefined) ?? row.titleAr) as string,
    bodyAr: row.bodyAr,
    bodyEn: (row.bodyEn ?? (extra?.bodyEn as string | undefined) ?? row.bodyAr) as string,
    type: contractType,
    read: isRead,
    isRead,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    deepLink: (row.deepLink ?? (extra?.deepLink as string | undefined)) ?? null,
    payload: rowPayload ?? ((extra?.payload as Record<string, unknown> | undefined) ?? null),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listNotifications(
  userId: string,
  page: number,
  perPage: number,
) {
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedPerPage = Math.min(100, Math.max(5, Number(perPage) || 20));
  const offset = (parsedPage - 1) * parsedPerPage;

  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: parsedPerPage,
      skip: offset,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  const paginationMeta = buildPaginationMeta(parsedPage, parsedPerPage, total);
  const data = rows.map((r) => serializeNotification(r));

  return {
    data,
    meta: {
      ...paginationMeta,
      unreadCount,
    },
  };
}

export async function getUnreadCount(userId: string) {
  const unreadCount = await prisma.notification.count({
    where: { userId, readAt: null },
  });
  return { count: unreadCount, unreadCount };
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

  const updated = await prisma.notification.findFirst({ where: { id, userId } });
  const unreadCount = await prisma.notification.count({
    where: { userId, readAt: null },
  });

  if (!updated) {
    throw new AppError(
      'Notification not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  return {
    ...serializeNotification(updated),
    unreadCount,
  };
}

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  const unreadCount = await prisma.notification.count({
    where: { userId, readAt: null },
  });
  return { markedCount: result.count, unreadCount };
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

  return serializeNotification(notification);
}

export async function createNotification(input: {
  userId: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  type?: 'SYSTEM' | 'AZAN' | 'CHALLENGE' | 'PRAYER_REMINDER' | 'ACHIEVEMENT' | 'GENERAL';
  deepLink?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      bodyAr: input.bodyAr,
      bodyEn: input.bodyEn,
      type: (input.type ?? 'SYSTEM') as any,
      deepLink: input.deepLink ?? null,
      payload: (input.payload ?? undefined) as any,
    },
  });
  return serializeNotification(row);
}

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
  /** How many times this reminder came since it was last read (repeats fold into one row). */
  repeatCount?: number;
  unreadCount?: number;
};

function mapNotificationTypeToContract(prismaType: string): string {
  const typeUpper = String(prismaType || 'GENERAL').toUpperCase();
  switch (typeUpper) {
    case 'PRAYER_REMINDER':
    case 'AZAN':
      return 'AZAN';
    case 'SALAWAT':
      return 'SALAWAT';
    case 'MULK':
      return 'MULK';
    case 'DUHA':
      return 'DUHA';
    case 'QIYAM':
      return 'QIYAM';
    case 'KHATMAH':
      return 'KHATMAH';
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
    type: rowPayload?.type === 'CHARITY_REMINDER' ? 'CHARITY_REMINDER' : rowPayload?.type === 'KAHF' ? 'KAHF' : contractType,
    read: isRead,
    isRead,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    deepLink: (row.deepLink ?? (extra?.deepLink as string | undefined)) ?? null,
    payload: rowPayload ?? ((extra?.payload as Record<string, unknown> | undefined) ?? null),
    createdAt: row.createdAt.toISOString(),
    repeatCount: typeof rowPayload?.repeatCount === 'number' ? rowPayload.repeatCount : 1,
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

/** Kinds that are one moment each (the Adhan of a prayer, a challenge reward) are never folded together. */
const NEVER_COLLAPSE_CONTRACT_TYPES = new Set(['AZAN', 'CHALLENGE']);
/** A repeated reminder folds into the unread one of the same kind from the last 24 hours. */
export const COLLAPSE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Read notifications are kept 30 days; anything older than 90 days goes. */
export const READ_RETENTION_DAYS = 30;
export const MAX_RETENTION_DAYS = 90;

/** The kind a notification is grouped by: its contract type plus the reminder kind carried in its payload. */
export function notificationGroupKey(type: string, payload?: Record<string, unknown> | null): string {
  const contract = mapNotificationTypeToContract(type);
  const sub = payload && typeof payload.type === 'string' ? payload.type : payload && typeof payload.kind === 'string' ? payload.kind : '';
  return `${contract}|${sub}`;
}

export function isCollapsibleNotification(type: string, payload?: Record<string, unknown> | null): boolean {
  if (payload && payload.collapse === false) return false;
  return !NEVER_COLLAPSE_CONTRACT_TYPES.has(mapNotificationTypeToContract(type));
}

export async function createNotification(input: {
  userId: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  type?: 'SYSTEM' | 'AZAN' | 'CHALLENGE' | 'PRAYER_REMINDER' | 'ACHIEVEMENT' | 'GENERAL' | 'SALAWAT';
  deepLink?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  const type = input.type ?? 'SYSTEM';
  if (isCollapsibleNotification(type, input.payload)) {
    const key = notificationGroupKey(type, input.payload);
    const since = new Date(Date.now() - COLLAPSE_WINDOW_MS);
    const recent = await prisma.notification.findMany({
      where: { userId: input.userId, type: type as any, readAt: null, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const same = recent.find(r => notificationGroupKey(String(r.type), r.payload as Record<string, unknown> | null) === key);
    if (same) {
      const prev = (same.payload ?? {}) as Record<string, unknown>;
      const prevCount = typeof prev.repeatCount === 'number' && prev.repeatCount >= 1 ? prev.repeatCount : 1;
      const row = await prisma.notification.update({
        where: { id: same.id },
        data: {
          titleAr: input.titleAr,
          titleEn: input.titleEn,
          bodyAr: input.bodyAr,
          bodyEn: input.bodyEn,
          deepLink: input.deepLink ?? same.deepLink ?? null,
          createdAt: new Date(),
          payload: {
            ...(input.payload ?? {}),
            repeatCount: prevCount + 1,
            firstAt: typeof prev.firstAt === 'string' ? prev.firstAt : same.createdAt.toISOString(),
          } as any,
        },
      });
      return serializeNotification(row);
    }
  }
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      bodyAr: input.bodyAr,
      bodyEn: input.bodyEn,
      type: type as any,
      deepLink: input.deepLink ?? null,
      payload: (input.payload ?? undefined) as any,
    },
  });
  return serializeNotification(row);
}

/** Drops read notifications older than 30 days and every notification older than 90 days. */
export async function pruneOldNotifications(now = new Date()) {
  const day = 24 * 60 * 60 * 1000;
  const readCut = new Date(now.getTime() - READ_RETENTION_DAYS * day);
  const allCut = new Date(now.getTime() - MAX_RETENTION_DAYS * day);
  const result = await prisma.notification.deleteMany({
    where: { OR: [{ readAt: { not: null }, createdAt: { lt: readCut } }, { createdAt: { lt: allCut } }] },
  });
  return { deleted: result.count };
}

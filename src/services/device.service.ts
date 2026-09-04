import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { sendFcmToTokens, isFcmConfigured } from '../lib/fcm';
import { logger } from '../lib/logger';

export type RegisterDeviceInput = {
  token: string;
  platform?: string;
  appVersion?: string;
  locale?: string;
};

export async function registerDeviceToken(userId: string, input: RegisterDeviceInput) {
  const token = input.token?.trim();
  if (!token || token.length < 10) {
    throw new AppError('Valid FCM token is required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  const platform = (input.platform ?? 'unknown').toLowerCase().slice(0, 32);

  const row = await prisma.deviceToken.upsert({
    where: { token },
    create: {
      userId,
      token,
      platform,
      appVersion: input.appVersion?.slice(0, 64),
      locale: input.locale?.slice(0, 32),
      lastSeenAt: new Date(),
    },
    update: {
      userId,
      platform,
      appVersion: input.appVersion?.slice(0, 64),
      locale: input.locale?.slice(0, 32),
      lastSeenAt: new Date(),
    },
  });

  return {
    id: row.id,
    token: row.token,
    platform: row.platform,
    registered: true,
    fcmConfigured: isFcmConfigured(),
  };
}

export async function unregisterDeviceToken(userId: string, token: string) {
  const existing = await prisma.deviceToken.findUnique({ where: { token: token.trim() } });
  if (!existing || existing.userId !== userId) {
    // Idempotent success for Flutter outbox replay
    return { removed: false };
  }
  await prisma.deviceToken.delete({ where: { id: existing.id } });
  return { removed: true };
}

export async function listUserDeviceTokens(userId: string) {
  const rows = await prisma.deviceToken.findMany({
    where: { userId },
    select: { id: true, platform: true, appVersion: true, locale: true, lastSeenAt: true, createdAt: true },
    orderBy: { updatedAt: 'desc' },
  });
  return { devices: rows, fcmConfigured: isFcmConfigured() };
}

export async function sendPushToUser(
  userId: string,
  payload: {
    title: string;
    body: string;
    titleAr?: string;
    bodyAr?: string;
    data?: Record<string, string>;
  },
) {
  const tokens = await prisma.deviceToken.findMany({
    where: { userId },
    select: { token: true },
  });
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, reason: 'NO_DEVICE_TOKENS' as const };
  }

  const result = await sendFcmToTokens(
    tokens.map((t) => t.token),
    {
      title: payload.title,
      body: payload.body,
      data: {
        ...(payload.data ?? {}),
        titleAr: payload.titleAr ?? '',
        bodyAr: payload.bodyAr ?? '',
      },
    },
  );

  // Drop invalid tokens
  if (result.invalidTokens.length > 0) {
    await prisma.deviceToken.deleteMany({
      where: { token: { in: result.invalidTokens } },
    }).catch((err) => {
      logger.warn('[Devices] Failed to prune invalid FCM tokens', { message: (err as Error)?.message });
    });
  }

  return {
    sent: result.successCount,
    failed: result.failureCount,
    fcmConfigured: isFcmConfigured(),
  };
}

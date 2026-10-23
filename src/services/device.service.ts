import { azanChannelId } from '../shared/utils/notification-channels';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { sendFcmToTokens, isFcmConfigured } from '../lib/fcm';
import { logger } from '../lib/logger';
import { logPushDelivery } from '../lib/push-diagnostics';
import { REPAIRED_CHANNEL_IDS } from '../shared/utils/notification-channel-manifest';

/** Declared by the app on token registration (see GET /devices/notification-channels). */
export type DeviceCapabilities = {
  channelSchemaVersion?: number;
  bundledSounds?: string[];
  supportedTypes?: string[];
  notificationsEnabled?: boolean;
  exactAlarmsAllowed?: boolean;
};

export type RegisterDeviceInput = {
  token: string;
  platform?: string;
  appVersion?: string;
  locale?: string;
  capabilities?: DeviceCapabilities;
};

function normalizeCapabilities(raw: DeviceCapabilities | undefined) {
  if (!raw) return undefined;
  return {
    ...(raw.channelSchemaVersion != null ? { channelSchemaVersion: raw.channelSchemaVersion } : {}),
    ...(raw.bundledSounds ? { bundledSounds: [...new Set(raw.bundledSounds)].sort() } : {}),
    ...(raw.supportedTypes ? { supportedTypes: [...new Set(raw.supportedTypes)].sort() } : {}),
    ...(raw.notificationsEnabled != null ? { notificationsEnabled: raw.notificationsEnabled } : {}),
    ...(raw.exactAlarmsAllowed != null ? { exactAlarmsAllowed: raw.exactAlarmsAllowed } : {}),
    reportedAt: new Date().toISOString(),
  };
}

function deviceChannelSchemaVersion(capabilities: unknown): number {
  const v = (capabilities as { channelSchemaVersion?: unknown } | null | undefined)?.channelSchemaVersion;
  return typeof v === 'number' && Number.isFinite(v) ? v : 1;
}

/**
 * Android un-deletes a deleted channel WITH its old (silent) settings when the same id is
 * created again, so channels that shipped silent can only be repaired under a new id.
 * Devices declaring channelSchemaVersion >= 2 created the `_v2` channels with sound.
 */
export function resolveDeviceChannelId(channelId: string | undefined, schemaVersion: number): string | undefined {
  const base = channelId || 'general';
  if (schemaVersion >= 2 && REPAIRED_CHANNEL_IDS.has(base)) return `${base}_v2`;
  return channelId;
}

/**
 * True only when the user has at least one device and EVERY device declared that it bundles
 * `sound`. One multicast reaches all devices, so an optional sound is used only when no
 * device would fall back to a missing raw resource / channel. Old clients never declare.
 */
export async function allUserDevicesBundleSound(userId: string, sound: string): Promise<boolean> {
  let rows: Array<{ capabilities: unknown }>;
  try {
    rows = await prisma.deviceToken.findMany({
      where: { userId },
      select: { capabilities: true },
    });
  } catch (err) {
    // Column missing (migration not applied yet) → behave like an old client: no optional sounds.
    logger.warn('[Push] capabilities lookup failed; treating devices as legacy', {
      code: (err as { code?: string })?.code,
    });
    return false;
  }
  if (rows.length === 0) return false;
  return rows.every((row) => {
    const caps = row.capabilities as { bundledSounds?: unknown } | null;
    return Array.isArray(caps?.bundledSounds) && caps!.bundledSounds.includes(sound);
  });
}

export async function registerDeviceToken(userId: string, input: RegisterDeviceInput) {
  const token = input.token?.trim();
  if (!token || token.length < 10) {
    throw new AppError('Valid FCM token is required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  const platform = (input.platform ?? 'unknown').toLowerCase().slice(0, 32);
  const capabilities = normalizeCapabilities(input.capabilities);

  const row = await prisma.deviceToken.upsert({
    where: { token },
    create: {
      userId,
      token,
      platform,
      appVersion: input.appVersion?.slice(0, 64),
      locale: input.locale?.slice(0, 32),
      ...(capabilities ? { capabilities } : {}),
      lastSeenAt: new Date(),
    },
    update: {
      userId,
      // Never downgrade a known platform to "unknown" when an older call omits it.
      ...(input.platform ? { platform } : {}),
      appVersion: input.appVersion?.slice(0, 64),
      locale: input.locale?.slice(0, 32),
      ...(capabilities ? { capabilities } : {}),
      lastSeenAt: new Date(),
    },
  });

  logger.info('[Push] device_token_registered', {
    event: 'device_token_registered',
    blame: 'FLUTTER_OK_TOKEN_SYNCED',
    userId,
    platform,
    appVersion: input.appVersion?.slice(0, 64),
    locale: input.locale?.slice(0, 32),
    tokenFingerprint: `${token.slice(0, 8)}…`,
    channelSchemaVersion: capabilities?.channelSchemaVersion ?? null,
    bundledSoundCount: capabilities?.bundledSounds?.length ?? null,
  });

  return {
    id: row.id,
    token: row.token,
    platform: row.platform,
    registered: true,
    fcmConfigured: isFcmConfigured(),
    capabilitiesStored: Boolean(capabilities),
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
    select: { id: true, platform: true, appVersion: true, locale: true, capabilities: true, lastSeenAt: true, createdAt: true },
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
    /** Passed through to FCM for Android/APNS native sound selection. */
    nativeSound?: string | null;
    /** Android notification channel ID override. */
    androidChannelId?: string;
    ttlSeconds?: number;
    iosInterruptionLevel?: 'active' | 'time-sensitive';
  },
) {
  let tokens: Array<{ token: string; capabilities?: unknown }>;
  try {
    tokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true, capabilities: true },
    });
  } catch {
    // capabilities column not migrated yet → legacy channel ids for everyone.
    tokens = await prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
  }
  const dataForLog = {
    ...(payload.data ?? {}),
    titleAr: payload.titleAr ?? '',
    bodyAr: payload.bodyAr ?? '',
  };

  if (tokens.length === 0) {
    const out = { sent: 0, failed: 0, reason: 'NO_DEVICE_TOKENS' as const };
    logPushDelivery({
      userId,
      ...out,
      fcmConfigured: isFcmConfigured(),
      tokenCount: 0,
      androidChannelId: payload.androidChannelId,
      nativeSound: payload.nativeSound,
      data: dataForLog,
    });
    return out;
  }

  // Devices that synced channel schema v2 get the re-created (audible) reminder channels;
  // older installs keep the ids they already have. One multicast per group.
  const groups = new Map<string, { tokens: string[]; channel: string | undefined; nativeSound: string | null | undefined; data: Record<string, string> }>();
  for (const t of tokens) {
    const channel = resolveDeviceChannelId(payload.androidChannelId, deviceChannelSchemaVersion(t.capabilities));
    const audio = resolveTakbirDeviceAudio(t.capabilities, { ...payload, androidChannelId: channel, data: dataForLog });
    const key = JSON.stringify([audio.androidChannelId ?? '', audio.nativeSound, audio.data.audioFallbackReason ?? '']);
    const group = groups.get(key) ?? { tokens: [], channel: audio.androidChannelId, nativeSound: audio.nativeSound, data: audio.data };
    group.tokens.push(t.token);
    groups.set(key, group);
  }
  const result = { successCount: 0, failureCount: 0, invalidTokens: [] as string[], configured: true, errorCodes: [] as string[] };
  for (const group of groups.values()) {
    const r = await sendFcmToTokens(group.tokens, {
      title: payload.title,
      body: payload.body,
      data: group.data,
      nativeSound: group.nativeSound,
      androidChannelId: group.channel || undefined,
      ttlSeconds: payload.ttlSeconds,
      iosInterruptionLevel: payload.iosInterruptionLevel,
    });
    result.successCount += r.successCount;
    result.failureCount += r.failureCount;
    result.invalidTokens.push(...r.invalidTokens);
    result.configured = result.configured && r.configured;
    for (const code of r.errorCodes ?? []) if (!result.errorCodes.includes(code)) result.errorCodes.push(code);
  }

  // Drop invalid tokens
  if (result.invalidTokens.length > 0) {
    await prisma.deviceToken.deleteMany({
      where: { token: { in: result.invalidTokens } },
    }).catch((err) => {
      logger.warn('[Devices] Failed to prune invalid FCM tokens', { message: (err as Error)?.message });
    });
  }

  const out = {
    sent: result.successCount,
    failed: result.failureCount,
    fcmConfigured: result.configured,
    invalidTokenCount: result.invalidTokens.length,
  };

  logPushDelivery({
    userId,
    ...out,
    tokenCount: tokens.length,
    androidChannelId: payload.androidChannelId,
    nativeSound: payload.nativeSound,
    data: dataForLog,
    fcmErrorCodes: result.errorCodes,
  });

  return out;
}

/** Old installs must never turn a requested short takbir into full Adhan. */
export function resolveTakbirDeviceAudio(capabilities: unknown, payload: {
  data?: Record<string, string>; nativeSound?: string | null; androidChannelId?: string;
}) {
  const data = { ...(payload.data ?? {}) };
  if (data.audioScope !== 'prayer_time_takbir' || payload.nativeSound === null)
    return { data, nativeSound: payload.nativeSound, androidChannelId: payload.androidChannelId };
  const caps = capabilities as { channelSchemaVersion?: number; bundledSounds?: unknown } | null;
  const ready = Number(caps?.channelSchemaVersion ?? 0) >= 3 && Array.isArray(caps?.bundledSounds)
    && caps.bundledSounds.includes(payload.nativeSound);
  if (ready) return { data, nativeSound: payload.nativeSound, androidChannelId: payload.androidChannelId };
  return { data: { ...data, soundEnabled: 'false', nativeSound: '', androidChannelId: azanChannelId('silent', false, data.vibrationEnabled !== 'false'), audioFallbackReason: 'TAKBIR_NOT_BUNDLED_ON_DEVICE' },
    nativeSound: null, androidChannelId: azanChannelId('silent', false, data.vibrationEnabled !== 'false') };
}

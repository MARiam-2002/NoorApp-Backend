/**
 * Structured push delivery diagnostics (2026).
 * Goal: one Railway log line tells you whether blame is Backend vs Flutter APK.
 *
 * How to read:
 * - blame=BACKEND_OK_FLUTTER_MUST_PLAY → FCM accepted the message; tray may show.
 *   Full Adhan / Salawat audio is Flutter’s job from data.azanSoundUrl / audioUrl.
 * - blame=FLUTTER_NO_DEVICE_TOKEN → app never registered (or cleared) FCM token.
 * - blame=BACKEND_NO_FCM_CONFIG → Firebase Admin not configured on server.
 * - blame=FLUTTER_TOKEN_INVALID_OR_FCM_REJECT → stale token or FCM rejected devices.
 */

import { logger } from './logger';

export type PushBlame =
  | 'BACKEND_OK_FLUTTER_MUST_PLAY'
  | 'BACKEND_NO_FCM_CONFIG'
  | 'FLUTTER_NO_DEVICE_TOKEN'
  | 'FLUTTER_TOKEN_INVALID_OR_FCM_REJECT'
  | 'BACKEND_PARTIAL_DELIVERY'
  | 'UNKNOWN';

export type PushDeliveryResult = {
  sent: number;
  failed: number;
  reason?: 'NO_DEVICE_TOKENS';
  fcmConfigured?: boolean;
  invalidTokenCount?: number;
};

export function resolvePushBlame(result: PushDeliveryResult): PushBlame {
  if (result.reason === 'NO_DEVICE_TOKENS') return 'FLUTTER_NO_DEVICE_TOKEN';
  if (result.fcmConfigured === false) return 'BACKEND_NO_FCM_CONFIG';
  if (result.sent > 0 && result.failed === 0) return 'BACKEND_OK_FLUTTER_MUST_PLAY';
  if (result.sent > 0 && result.failed > 0) return 'BACKEND_PARTIAL_DELIVERY';
  if (result.sent === 0 && result.failed > 0) return 'FLUTTER_TOKEN_INVALID_OR_FCM_REJECT';
  return 'UNKNOWN';
}

function pickData(data: Record<string, string> | undefined, key: string): string | undefined {
  const v = data?.[key];
  return v != null && String(v).trim() !== '' ? String(v) : undefined;
}

/**
 * Log one delivery attempt. Safe for production (no raw FCM token).
 */
export function logPushDelivery(input: {
  userId: string;
  userEmail?: string | null;
  sent: number;
  failed: number;
  reason?: 'NO_DEVICE_TOKENS';
  fcmConfigured?: boolean;
  invalidTokenCount?: number;
  tokenCount?: number;
  androidChannelId?: string;
  nativeSound?: string | null;
  data?: Record<string, string>;
  fcmErrorCodes?: string[];
}): PushBlame {
  const blame = resolvePushBlame(input);
  const data = input.data;
  const eventType = pickData(data, 'eventType') ?? pickData(data, 'kind') ?? 'UNKNOWN';
  const soundType = pickData(data, 'soundType');
  const soundId =
    pickData(data, 'soundId') ??
    pickData(data, 'azanSoundId') ??
    pickData(data, 'audioClipId') ??
    pickData(data, 'notificationSoundId');
  const audioUrl =
    pickData(data, 'azanSoundUrl') ??
    pickData(data, 'notificationSoundUrl') ??
    pickData(data, 'audioUrl');
  const dedupeKey = pickData(data, 'dedupeKey');
  const eventKey = pickData(data, 'eventKey') ?? pickData(data, 'prayerKey');
  const source = pickData(data, 'source') ?? 'UNKNOWN';

  const meta = {
    event: 'push_delivery',
    blame,
    userId: input.userId,
    userEmail: input.userEmail || undefined,
    eventType,
    eventKey,
    soundType,
    soundId,
    hasAudioUrl: Boolean(audioUrl),
    audioUrlHost: audioUrl ? safeHost(audioUrl) : undefined,
    dedupeKey,
    source,
    androidChannelId: input.androidChannelId,
    nativeSound: input.nativeSound === null ? 'silent' : input.nativeSound ?? undefined,
    tokenCount: input.tokenCount,
    sent: input.sent,
    failed: input.failed,
    invalidTokenCount: input.invalidTokenCount ?? 0,
    fcmConfigured: input.fcmConfigured,
    fcmErrorCodes: input.fcmErrorCodes?.length ? input.fcmErrorCodes : undefined,
    /** Human hint for on-call / Flutter debug */
    nextCheck:
      blame === 'BACKEND_OK_FLUTTER_MUST_PLAY'
        ? 'If tray showed but no Adhan/Salawat audio → Flutter must play from data URL / bundled file (not OS notification sound).'
        : blame === 'FLUTTER_NO_DEVICE_TOKEN'
          ? 'Flutter must POST device FCM token after login / permission grant.'
          : blame === 'BACKEND_NO_FCM_CONFIG'
            ? 'Set FIREBASE_SERVICE_ACCOUNT_JSON on Railway; GET /health → fcm.configured true.'
            : blame === 'FLUTTER_TOKEN_INVALID_OR_FCM_REJECT'
              ? 'Re-register FCM token; check Firebase project matches APK google-services.json.'
              : undefined,
  };

  if (blame === 'BACKEND_OK_FLUTTER_MUST_PLAY' || blame === 'BACKEND_PARTIAL_DELIVERY') {
    logger.info('[Push] delivery', meta);
  } else {
    logger.warn('[Push] delivery', meta);
  }

  return blame;
}

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

/** Cron / batch summary — one line per job. */
export function logPushCronSummary(input: {
  job: 'prayer_reminders';
  windowMinutes?: number;
  usersScanned: number;
  pushesAttempted: number;
  pushesSent: number;
  azan?: { usersScanned: number; pushesAttempted: number; pushesSent: number };
  salawat?: {
    usersScanned: number;
    pushesAttempted: number;
    pushesSent: number;
    skipped?: Record<string, number>;
  };
  mulk?: {
    usersScanned: number;
    pushesAttempted: number;
    pushesSent: number;
    skipped?: Record<string, number>;
  };
  duha?: {
    usersScanned: number;
    pushesAttempted: number;
    pushesSent: number;
    skipped?: Record<string, number>;
  };
  qiyam?: {
    usersScanned: number;
    pushesAttempted: number;
    pushesSent: number;
    skipped?: Record<string, number>;
  };
}): void {
  logger.info('[Push] cron_summary', {
    event: 'push_cron_summary',
    ...input,
    note:
      'pushesSent>0 means Backend→FCM accepted. Missing Adhan audio after tray = Flutter playback.',
  });
}

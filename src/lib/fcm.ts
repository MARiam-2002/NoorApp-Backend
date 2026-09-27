import { env } from '../config';
import { logger } from './logger';

type FcmPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  /**
   * Android notification channel sound resource name (without extension) or file path.
   * APNs: name of the sound file in the app bundle / Library/Sounds.
   * Pass 'default' for OS default. Pass null/undefined for silent notification.
   */
  nativeSound?: string | null;
  /** Android notification channel ID (must exist on the device). Defaults to `general`. */
  androidChannelId?: string;
  /**
   * Drop the message if it cannot be delivered within this many seconds (device offline).
   * Omit for FCM's default (up to 4 weeks) — only acceptable for non-time-sensitive pushes.
   */
  ttlSeconds?: number;
  /**
   * iOS 15+ delivery level. `time-sensitive` breaks through Focus / Scheduled Summary
   * when the app has the Time Sensitive Notifications capability (ignored otherwise).
   */
  iosInterruptionLevel?: 'active' | 'time-sensitive';
};

const APNS_COLLAPSE_ID_MAX_BYTES = 64;

/** APNs needs the bundled file name with extension; Android wants the bare raw name. */
function apnsSoundName(nativeSound: string): string {
  if (nativeSound === 'default' || nativeSound.includes('.')) return nativeSound;
  return `${nativeSound}.caf`;
}

type SendResult = {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
  configured: boolean;
  /** Sample FCM error codes (no tokens) for Railway diagnosis. */
  errorCodes?: string[];
};

let messaging: any = null;
let initAttempted = false;

function readPrivateKey(): string {
  return (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

export function isFcmConfigured(): boolean {
  const json = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  return Boolean(json) || Boolean(
    env.FIREBASE_PROJECT_ID?.trim() &&
      env.FIREBASE_CLIENT_EMAIL?.trim() &&
      env.FIREBASE_PRIVATE_KEY?.trim(),
  );
}

async function getMessaging(): Promise<any | null> {
  if (messaging) return messaging;
  if (initAttempted && !messaging) return null;
  initAttempted = true;

  if (!isFcmConfigured()) {
    logger.warn('[FCM] Not configured — set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY');
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const json = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
      if (json) {
        const cred = JSON.parse(json);
        if (typeof cred.private_key === 'string') {
          cred.private_key = cred.private_key.replace(/\\n/g, '\n');
        }
        admin.initializeApp({ credential: admin.credential.cert(cred) });
      } else {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey: readPrivateKey(),
          }),
        });
      }
    }
    messaging = admin.messaging();
    return messaging;
  } catch (err) {
    logger.error('[FCM] Failed to initialize firebase-admin', {
      message: (err as Error)?.message,
    });
    return null;
  }
}

export async function sendFcmToTokens(
  tokens: string[],
  payload: FcmPayload,
): Promise<SendResult> {
  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [], configured: isFcmConfigured() };
  }

  const msg = await getMessaging();
  if (!msg) {
    return {
      successCount: 0,
      failureCount: unique.length,
      invalidTokens: [],
      configured: false,
    };
  }

  const nativeSound =
    payload.nativeSound === undefined || payload.nativeSound === null
      ? 'default'
      : String(payload.nativeSound);
  const soundExplicitlyDisabled = payload.nativeSound === null;

  const androidNotif: any = {
    channelId: payload.androidChannelId || 'general',
  };
  if (!soundExplicitlyDisabled) {
    androidNotif.sound = nativeSound;
  }
  // Same logical reminder retried / re-sent replaces the tray entry instead of stacking.
  const occurrenceKey = payload.data?.occurrenceKey;
  if (occurrenceKey) {
    androidNotif.tag = occurrenceKey;
  }

  const aps: any = {
    contentAvailable: true,
  };
  if (!soundExplicitlyDisabled) {
    aps.sound = apnsSoundName(nativeSound);
  }
  if (payload.iosInterruptionLevel) {
    aps['interruption-level'] = payload.iosInterruptionLevel;
  }
  if (payload.data?.type) {
    aps.threadId = payload.data.type;
  }

  const ttlSeconds =
    payload.ttlSeconds != null && Number.isFinite(payload.ttlSeconds)
      ? Math.max(0, Math.floor(payload.ttlSeconds))
      : null;
  const apnsHeaders: Record<string, string> = {
    'apns-priority': '10',
    'apns-push-type': 'alert',
  };
  if (ttlSeconds != null) {
    apnsHeaders['apns-expiration'] = String(Math.floor(Date.now() / 1000) + ttlSeconds);
  }
  if (occurrenceKey && Buffer.byteLength(occurrenceKey, 'utf8') <= APNS_COLLAPSE_ID_MAX_BYTES) {
    apnsHeaders['apns-collapse-id'] = occurrenceKey;
  }

  const response = await msg.sendEachForMulticast({
    tokens: unique,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: Object.fromEntries(
      Object.entries(payload.data ?? {}).map(([k, v]) => [k, String(v ?? '')]),
    ),
    android: {
      priority: 'high',
      ...(ttlSeconds != null ? { ttl: ttlSeconds * 1000 } : {}),
      notification: androidNotif,
    },
    apns: {
      headers: apnsHeaders,
      payload: {
        aps,
      },
    },
  });

  const invalidTokens: string[] = [];
  const errorCodes: string[] = [];
  response.responses.forEach((r: any, idx: number) => {
    if (r.success) return;
    const code = String(r.error?.code || 'unknown');
    if (errorCodes.length < 5 && !errorCodes.includes(code)) errorCodes.push(code);
    if (
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token') ||
      code.includes('invalid-argument')
    ) {
      invalidTokens.push(unique[idx]!);
    }
  });

  return {
    successCount: response.successCount ?? 0,
    failureCount: response.failureCount ?? 0,
    invalidTokens,
    configured: true,
    errorCodes,
  };
}

export function getFcmStatus() {
  return {
    configured: isFcmConfigured(),
    initialized: Boolean(messaging),
  };
}

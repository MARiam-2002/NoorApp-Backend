import { env } from '../config';
import { logger } from './logger';

type FcmPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

type SendResult = {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
  configured: boolean;
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
      notification: {
        channelId: 'azan',
        sound: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          contentAvailable: true,
        },
      },
    },
  });

  const invalidTokens: string[] = [];
  response.responses.forEach((r: any, idx: number) => {
    if (r.success) return;
    const code = r.error?.code || '';
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
  };
}

export function getFcmStatus() {
  return {
    configured: isFcmConfigured(),
    initialized: Boolean(messaging),
  };
}

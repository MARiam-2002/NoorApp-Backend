import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../shared/utils/validator';
import {
  registerFcmTokenHandler,
  unregisterFcmTokenHandler,
  listDevicesHandler,
  sendTestPushHandler,
  notificationChannelsHandler,
} from '../controllers/device.controller';

/**
 * What this install can actually play / display. Old clients omit it; the backend then
 * never targets optional sounds (e.g. prayer-time announcement clips) on that device.
 */
export const deviceCapabilitiesSchema = z.object({
  channelSchemaVersion: z.coerce.number().int().min(1).max(1000).optional(),
  bundledSounds: z.array(z.string().regex(/^[a-z0-9_]{1,64}$/)).max(300).optional(),
  supportedTypes: z.array(z.string().regex(/^[A-Z_]{1,40}$/)).max(60).optional(),
  notificationsEnabled: z.boolean().optional(),
  exactAlarmsAllowed: z.boolean().optional(),
});

const tokenBodySchema = z.object({
  token: z.string().min(10).optional(),
  fcmToken: z.string().min(10).optional(),
  platform: z.string().trim().min(1).max(32).optional(),
  appVersion: z.string().trim().max(64).optional(),
  locale: z.string().trim().max(32).optional(),
  capabilities: deviceCapabilitiesSchema.optional(),
}).superRefine((val, ctx) => {
  if (!val.token && !val.fcmToken) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'token or fcmToken is required', path: ['token'] });
  }
});

export const devicesRouter = Router();

/**
 * @openapi
 * /devices/fcm-token:
 *   post:
 *     tags: ['Devices']
 *     summary: Register FCM device token for push (Azan backup + general)
 *     security: [ { bearerAuth: [] } ]
 */
devicesRouter.post('/fcm-token', authenticate, validate(tokenBodySchema), registerFcmTokenHandler);

/**
 * @openapi
 * /devices/fcm-token:
 *   delete:
 *     tags: ['Devices']
 *     summary: Unregister FCM device token
 *     security: [ { bearerAuth: [] } ]
 */
devicesRouter.delete('/fcm-token', authenticate, validate(tokenBodySchema), unregisterFcmTokenHandler);

/**
 * @openapi
 * /devices/notification-channels:
 *   get:
 *     tags: ['Devices']
 *     summary: Canonical Android channels + iOS sound files the backend may target
 *     description: |
 *       Public, cacheable. Flutter must create every listed Android channel with exactly the
 *       listed sound/importance/usage, bundle every `requiredBundledSounds` entry
 *       (android/app/src/main/res/raw/<name>.mp3 and ios/Runner/<name>.caf), and handle every
 *       `fcmTypes` value in foreground and background. `nativeSound: "default"` means the OS
 *       default tone (sound ON); `null` means intentionally silent.
 */
devicesRouter.get('/notification-channels', notificationChannelsHandler);

devicesRouter.get('/', authenticate, listDevicesHandler);
devicesRouter.post('/test-push', authenticate, sendTestPushHandler);

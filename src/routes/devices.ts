import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../shared/utils/validator';
import {
  registerFcmTokenHandler,
  unregisterFcmTokenHandler,
  listDevicesHandler,
  sendTestPushHandler,
} from '../controllers/device.controller';

const tokenBodySchema = z.object({
  token: z.string().min(10).optional(),
  fcmToken: z.string().min(10).optional(),
  platform: z.string().trim().min(1).max(32).optional(),
  appVersion: z.string().trim().max(64).optional(),
  locale: z.string().trim().max(32).optional(),
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

devicesRouter.get('/', authenticate, listDevicesHandler);
devicesRouter.post('/test-push', authenticate, sendTestPushHandler);

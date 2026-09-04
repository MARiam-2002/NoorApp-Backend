import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  listUserDeviceTokens,
  sendPushToUser,
} from '../services/device.service';

export const registerFcmTokenHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const { token, fcmToken, platform, appVersion, locale } = req.body as {
    token?: string;
    fcmToken?: string;
    platform?: string;
    appVersion?: string;
    locale?: string;
  };
  const data = await registerDeviceToken(userId, {
    token: token ?? fcmToken ?? '',
    platform,
    appVersion,
    locale,
  });
  sendSuccess(res, data, 'FCM device token registered successfully', req);
});

export const unregisterFcmTokenHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const { token, fcmToken } = req.body as { token?: string; fcmToken?: string };
  const data = await unregisterDeviceToken(userId, token ?? fcmToken ?? '');
  sendSuccess(res, data, 'FCM device token removed successfully', req);
});

export const listDevicesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const data = await listUserDeviceTokens(userId);
  sendSuccess(res, data, 'Device tokens retrieved successfully', req);
});

/** Dev/ops: send a test push to the caller's registered devices. */
export const sendTestPushHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const { title, body, titleAr, bodyAr } = (req.body ?? {}) as {
    title?: string;
    body?: string;
    titleAr?: string;
    bodyAr?: string;
  };
  const data = await sendPushToUser(userId, {
    title: title ?? 'Noor',
    body: body ?? 'Test notification',
    titleAr: titleAr ?? 'نور',
    bodyAr: bodyAr ?? 'إشعار تجريبي',
    data: { type: 'TEST' },
  });
  sendSuccess(res, data, 'Test push attempted', req);
});

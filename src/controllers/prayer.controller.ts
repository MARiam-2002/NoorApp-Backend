import type { Request, Response } from 'express';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import {
  getPrayerSchedule,
  getTodayPrayers,
  markPrayer,
} from '../services/prayer.service';

export const getToday = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const data = await getTodayPrayers(userId);
  sendSuccess(res, data, 'Prayer schedule retrieved successfully', req);
});

export const markPrayerHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { id } = req.params as { id: string };
  const data = await markPrayer(userId, id);
  sendSuccess(res, data, 'Prayer status updated successfully', req);
});

export const getSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { latitude, longitude, timezone, date } = req.query as {
    latitude?: string; longitude?: string; timezone?: string; date?: string };

  const lat = latitude ? Number(latitude) : undefined;
  const lng = longitude ? Number(longitude) : undefined;

  const data = await getPrayerSchedule(lat, lng, timezone, date);
  sendSuccess(res, data, 'Prayer schedule calculated successfully', req);
});

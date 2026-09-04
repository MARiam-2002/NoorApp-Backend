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
  const { latitude, longitude, lat, lng, timezone, date, method, madhab } = req.query as {
    latitude?: string;
    longitude?: string;
    lat?: string;
    lng?: string;
    timezone?: string;
    date?: string;
    method?: string;
    madhab?: string;
  };

  const resolvedLat = latitude ?? lat;
  const resolvedLng = longitude ?? lng;
  const parsedLat = resolvedLat ? Number(resolvedLat) : undefined;
  const parsedLng = resolvedLng ? Number(resolvedLng) : undefined;

  const data = await getPrayerSchedule(
    parsedLat,
    parsedLng,
    timezone,
    date,
    method,
    madhab,
  );
  sendSuccess(res, data, 'Prayer schedule calculated successfully', req);
});

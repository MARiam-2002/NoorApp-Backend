import type { Request, Response } from 'express';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { asyncHandler, successResponse } from '../middleware/common';
import {
  getPrayerSchedule,
  getTodayPrayers,
  markPrayer,
} from '../services/prayer.service';

function sendSuccess<T>(res: Response, data: T, message: string, statusCode = HttpStatus.OK) {
  return res.status(statusCode).json(successResponse(message, data));
}

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
  sendSuccess(res, data, 'Prayer schedule retrieved successfully');
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
  sendSuccess(res, data, 'Prayer status updated successfully');
});

export const getSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { latitude, longitude, timezone, date } = req.query as {
    latitude?: string; longitude?: string; timezone?: string; date?: string };

  const lat = latitude ? Number(latitude) : undefined;
  const lng = longitude ? Number(longitude) : undefined;

  const data = await getPrayerSchedule(lat, lng, timezone, date);
  sendSuccess(res, data, 'Prayer schedule calculated successfully');
});

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
  const { latitude, longitude, lat, lng, timezone, method, madhab } = req.query as {
    latitude?: string;
    longitude?: string;
    lat?: string;
    lng?: string;
    timezone?: string;
    method?: string;
    madhab?: string;
  };

  const resolvedLat = latitude ?? lat;
  const resolvedLng = longitude ?? lng;
  const parsedLat = resolvedLat != null && resolvedLat !== '' ? Number(resolvedLat) : undefined;
  const parsedLng = resolvedLng != null && resolvedLng !== '' ? Number(resolvedLng) : undefined;
  const hasCoords =
    parsedLat != null &&
    parsedLng != null &&
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng);

  // Public / guest path: coords in query (AZAN_FEATURE §9)
  if (hasCoords) {
    const data = await getPrayerSchedule(
      parsedLat,
      parsedLng,
      timezone,
      undefined,
      method,
      madhab,
    );
    // If authenticated, merge completion flags from user day
    if (userId) {
      const today = await getTodayPrayers(userId);
      const completedByName = new Map(
        (today.schedule ?? []).map((p: any) => [p.name, Boolean(p.completed)]),
      );
      data.schedule = (data.schedule ?? []).map((p: any) => ({
        ...p,
        completed: completedByName.get(p.name) ?? false,
      }));
    }
    sendSuccess(res, data, 'Prayer schedule retrieved successfully', req);
    return;
  }

  if (!userId) {
    throw new AppError(
      'Authentication required, or provide lat/lng query parameters',
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

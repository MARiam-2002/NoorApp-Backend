import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import {
  getDuhaPreferences,
  updateDuhaPreferences,
  getQiyamPreferences,
  updateQiyamPreferences,
} from '../services/extra-prayer-reminder.service';

const hhmmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm (00:00–23:59)');

export const extraPrayerPreferencesPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    time: hhmmSchema.optional(),
  })
  .refine((body) => body.enabled !== undefined || body.time !== undefined, {
    message: 'At least one of enabled, time is required',
  });

export const getDuhaPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const data = await getDuhaPreferences(userId);
  sendSuccess(res, data, 'Duha reminder preferences retrieved successfully', req);
});

export const patchDuhaPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const body = req.body as z.infer<typeof extraPrayerPreferencesPatchSchema>;
  const data = await updateDuhaPreferences(userId, body);
  sendSuccess(res, data, 'Duha reminder preferences updated successfully', req);
});

export const getQiyamPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const data = await getQiyamPreferences(userId);
  sendSuccess(res, data, 'Qiyam reminder preferences retrieved successfully', req);
});

export const patchQiyamPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const body = req.body as z.infer<typeof extraPrayerPreferencesPatchSchema>;
  const data = await updateQiyamPreferences(userId, body);
  sendSuccess(res, data, 'Qiyam reminder preferences updated successfully', req);
});

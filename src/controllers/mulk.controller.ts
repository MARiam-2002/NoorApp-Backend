import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import {
  getMulkPreferences,
  updateMulkPreferences,
} from '../services/mulk-reminder.service';

const hhmmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm (00:00–23:59)');

export const mulkPreferencesPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    time: hhmmSchema.optional(),
  })
  .refine((body) => body.enabled !== undefined || body.time !== undefined, {
    message: 'At least one of enabled, time is required',
  });

export const getMulkPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const data = await getMulkPreferences(userId);
  sendSuccess(res, data, 'Surah Al-Mulk reminder preferences retrieved successfully', req);
});

export const patchMulkPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const body = req.body as z.infer<typeof mulkPreferencesPatchSchema>;
  const data = await updateMulkPreferences(userId, {
    enabled: body.enabled,
    time: body.time,
  });
  sendSuccess(res, data, 'Surah Al-Mulk reminder preferences updated successfully', req);
});

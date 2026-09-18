import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import {
  getSalawatPreferences,
  updateSalawatPreferences,
  SALAWAT_ALLOWED_INTERVALS,
} from '../services/salawat-reminder.service';

const hhmmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm (00:00–23:59)');

const intervalSchema = z
  .number()
  .int()
  .refine((n) => (SALAWAT_ALLOWED_INTERVALS as readonly number[]).includes(n), {
    message: 'intervalMinutes must be 30, 60, 120, or 180',
  });

export const salawatPreferencesPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    intervalMinutes: intervalSchema.optional(),
    startTime: hhmmSchema.optional(),
    endTime: hhmmSchema.optional(),
  })
  .refine(
    (body) =>
      body.enabled !== undefined ||
      body.intervalMinutes !== undefined ||
      body.startTime !== undefined ||
      body.endTime !== undefined,
    { message: 'At least one of enabled, intervalMinutes, startTime, endTime is required' },
  );

export const getSalawatPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const data = await getSalawatPreferences(userId);
  sendSuccess(res, data, 'Salawat reminder preferences retrieved successfully', req);
});

export const patchSalawatPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const body = req.body as z.infer<typeof salawatPreferencesPatchSchema>;
  const data = await updateSalawatPreferences(userId, body);
  sendSuccess(res, data, 'Salawat reminder preferences updated successfully', req);
});

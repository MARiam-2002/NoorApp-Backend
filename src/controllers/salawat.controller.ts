import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import {
  getSalawatPreferences,
  updateSalawatPreferences,
} from '../services/salawat-reminder.service';

export const salawatPreferencesPatchSchema = z.object({
  enabled: z.boolean(),
});

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
  const { enabled } = salawatPreferencesPatchSchema.parse(req.body ?? {});
  const data = await updateSalawatPreferences(userId, enabled);
  sendSuccess(res, data, 'Salawat reminder preferences updated successfully', req);
});

import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import {
  getAzanPreferences,
  updateAzanPreferences,
  azanPreferencesSchema,
  type AzanPreferences,
} from '../services/azan.service';

export const getAzanPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const data = await getAzanPreferences(userId);
  sendSuccess(res, data, 'Azan preferences retrieved successfully', req);
});

export const patchAzanPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const parsed = azanPreferencesSchema.partial().parse(req.body ?? {});
  const data = await updateAzanPreferences(userId, parsed as Partial<AzanPreferences>);
  sendSuccess(res, data, 'Azan preferences updated successfully', req);
});

import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import {
  startKhatmahPlan,
  getKhatmahPlan,
  clearKhatmahPlan,
  getKhatmahReminderPreferences,
  updateKhatmahReminderPreferences,
} from '../services/khatmah-plan.service';

export const startKhatmahPlanSchema = z
  .object({
    durationDays: z.number().int().min(7).max(365).optional(),
    juzPerMonth: z.number().int().min(1).max(30).optional(),
  })
  .refine(
    (b) =>
      (b.durationDays != null && b.juzPerMonth == null) ||
      (b.juzPerMonth != null && b.durationDays == null),
    { message: 'Provide exactly one of durationDays or juzPerMonth' },
  );

export const khatmahReminderPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm')
      .optional(),
  })
  .refine((b) => b.enabled !== undefined || b.time !== undefined, {
    message: 'At least one of enabled, time is required',
  });

export const getKhatmahPlanHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const data = await getKhatmahPlan(userId);
  sendSuccess(res, data, 'Khatmah plan retrieved successfully', req);
});

export const startKhatmahPlanHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const body = req.body as z.infer<typeof startKhatmahPlanSchema>;
  const data = await startKhatmahPlan(
    userId,
    body.durationDays != null
      ? { durationDays: body.durationDays }
      : { juzPerMonth: body.juzPerMonth! },
  );
  sendSuccess(res, data, 'New khatmah plan started successfully', req, HttpStatus.CREATED);
});

export const clearKhatmahPlanHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const data = await clearKhatmahPlan(userId);
  sendSuccess(res, data, 'Khatmah plan cleared', req);
});

export const getKhatmahReminderHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const data = await getKhatmahReminderPreferences(userId);
  sendSuccess(res, data, 'Khatmah reminder preferences retrieved successfully', req);
});

export const patchKhatmahReminderHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const body = req.body as z.infer<typeof khatmahReminderPatchSchema>;
  const data = await updateKhatmahReminderPreferences(userId, body);
  sendSuccess(res, data, 'Khatmah reminder preferences updated successfully', req);
});

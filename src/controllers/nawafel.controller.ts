import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { getNawafelToday, markNawafel, getNawafelPreferences, updateNawafelPreferences, setNawafelCompletion } from '../services/nawafel.service';

export const getNawafelPreferencesHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, await getNawafelPreferences(req.user!.sub), 'Nawafel preferences retrieved', req);
});
export const patchNawafelPreferencesHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, await updateNawafelPreferences(req.user!.sub, req.body), 'Nawafel preferences updated', req);
});
export const setNawafelCompletionHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, await setNawafelCompletion(req.user!.sub, String(req.params.key), req.body), 'Nawafel completion state saved', req);
});

export const getNawafelTodayHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const data = await getNawafelToday(userId);
  sendSuccess(res, data, 'Nawafel (rawatib) for today retrieved successfully', req);
});

export const markNawafelHandler = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Link', '</api/v1/nawafel/{key}/completion>; rel="successor-version"');
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const key = String(req.params.key || '');
  const data = await markNawafel(userId, key);
  sendSuccess(
    res,
    data,
    data.completed ? 'Nawafel slot marked complete' : 'Nawafel slot unmarked',
    req,
  );
});

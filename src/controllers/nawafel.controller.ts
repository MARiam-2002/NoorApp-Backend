import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { getNawafelToday, markNawafel } from '../services/nawafel.service';

export const getNawafelTodayHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const data = await getNawafelToday(userId);
  sendSuccess(res, data, 'Nawafel (rawatib) for today retrieved successfully', req);
});

export const markNawafelHandler = asyncHandler(async (req: Request, res: Response) => {
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

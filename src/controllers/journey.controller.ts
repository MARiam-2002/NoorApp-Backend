import type { Request, Response } from 'express';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import {
  getTodayJourney,
  getJourneyProgress as getJourneyProgressService,
  updateQuranPages,
  incrementQuranPages as incrementQuranPagesService,
  updateAdhkar,
  updateSadaqah,
} from '../services/journey.service';

export const getJourneyToday = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const data = await getTodayJourney(userId);
  sendSuccess(res, data, 'Daily journey retrieved successfully', req);
});

export const getJourneyProgress = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { days } = req.query as { days?: string };
  const daysNum = days ? Number(days) : 7;

  const data = await getJourneyProgressService(userId, daysNum);
  sendSuccess(res, data, 'Journey progress retrieved successfully', req);
});

export const updateQuranPagesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { pages } = req.body as { pages: number };
  const data = await updateQuranPages(userId, pages);
  sendSuccess(res, data, 'Quran pages updated successfully', req);
});

export const incrementQuranPages = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { pages } = req.body as { pages?: number };
  const data = await incrementQuranPagesService(userId, pages ?? 1);
  sendSuccess(res, data, 'Quran pages incremented successfully', req);
});

export const patchAdhkar = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { completed } = req.body as { completed: boolean };
  const data = await updateAdhkar(userId, completed);
  sendSuccess(res, data, 'Adhkar status updated successfully', req);
});

export const patchSadaqah = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { amount } = req.body as { amount: number };
  const data = await updateSadaqah(userId, amount);
  sendSuccess(res, data, 'Sadaqah updated successfully', req);
});

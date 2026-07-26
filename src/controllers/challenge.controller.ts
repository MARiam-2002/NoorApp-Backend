import type { Request, Response } from 'express';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { asyncHandler, successResponse } from '../middleware/common';
import {
  claimChallenge,
  getAllChallenges,
  getChallengeByDay,
  getTodayChallenge,
} from '../services/challenge.service';

function sendSuccess<T>(res: Response, data: T, message: string, statusCode = HttpStatus.OK) {
  return res.status(statusCode).json(successResponse(message, data));
}

export const getChallenges = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const data = await getAllChallenges(userId);
  sendSuccess(res, data, 'Challenges retrieved successfully');
});

export const getChallengeById = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { id } = req.params;
  const data = await getChallengeByDay(userId, Number(id));

  if (!data) {
    throw new AppError(
      'Challenge not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  sendSuccess(res, data, 'Challenge retrieved successfully');
});

export const claimChallengeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
      );
    }

    const { id } = req.params as { id: string };
    const data = await claimChallenge(userId, id);
    sendSuccess(res, data, 'Challenge reward claimed successfully');
  },
);

export const claimToday = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const today = await getTodayChallenge(userId);
  if (!today) {
    throw new AppError(
      'No challenge available today',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  const data = await claimChallenge(userId, today.dayOfYear.toString());
  sendSuccess(res, data, 'Challenge reward claimed successfully');
});

export const getToday = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const data = await getTodayChallenge(userId);
  sendSuccess(res, data, 'Daily challenge retrieved successfully');
});

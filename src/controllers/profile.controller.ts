import type { Request, Response } from 'express';

import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import * as profileService from '../services/profile.service';

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const data = await profileService.getProfile(userId);

  sendSuccess(res, data, 'User profile retrieved successfully', req);
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { username, fullName, email, timezone } = req.body as {
    username?: string;
    fullName?: string | null;
    email?: string;
    timezone?: string;
  };
  const data = await profileService.updateProfile(userId, {
    ...(username !== undefined && { username }),
    ...(fullName !== undefined && { fullName: fullName === null ? null : fullName }),
    ...(email !== undefined && { email }),
    ...(timezone !== undefined && { timezone }),
  });

  sendSuccess(res, data, 'User profile updated successfully', req);
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };
  const data = await profileService.changePassword(userId, {
    currentPassword,
    newPassword,
  });

  sendSuccess(res, data, 'Password changed successfully', req);
});

export const updateLocation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { latitude, longitude, timezone } = req.body as {
    latitude: number;
    longitude: number;
    timezone?: string;
  };
  const data = await profileService.updateLocation(userId, {
    latitude,
    longitude,
    timezone,
  });

  sendSuccess(res, data, 'Location updated successfully', req);
});

export const getReadingPreferences = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const data = await profileService.getReadingPreferences(userId);
  sendSuccess(res, data, 'Reading preferences retrieved successfully', req);
});

export const updateReadingPreferences = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { quranFontSize, quranReciter, quranTafsir, quranTranslation, quranAutoScrollEnabled } = req.body as {
    quranFontSize?: number;
    quranReciter?: string;
    quranTafsir?: string;
    quranTranslation?: string;
    quranAutoScrollEnabled?: boolean;
  };

  const data = await profileService.updateReadingPreferences(userId, {
    ...(quranFontSize !== undefined && { quranFontSize }),
    ...(quranReciter !== undefined && { quranReciter }),
    ...(quranTafsir !== undefined && { quranTafsir }),
    ...(quranTranslation !== undefined && { quranTranslation }),
    ...(quranAutoScrollEnabled !== undefined && { quranAutoScrollEnabled }),
  });

  sendSuccess(res, data, 'Reading preferences updated successfully', req);
});

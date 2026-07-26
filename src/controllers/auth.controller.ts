import type { Request, Response } from 'express';

import { asyncHandler, sendSuccess } from '../middleware/common';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import * as authService from '../services/auth.service';

export const signUp = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password } = req.body as {
    username: string;
    email: string;
    password: string;
  };
  const result = await authService.signUp({ username, email, password });

  sendSuccess(res, result, 'Account created successfully', HttpStatus.CREATED);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const result = await authService.login({ email, password });

  sendSuccess(res, result, 'Logged in successfully');
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body as { refreshToken: string };
  const result = await authService.refreshToken({ refreshToken: token });

  sendSuccess(res, result, 'Token refreshed successfully');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body as { refreshToken: string };
  await authService.logout({ refreshToken: token });

  sendSuccess(res, null, 'Logged out successfully');
});

export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const user = await authService.getCurrentUser(userId);

  sendSuccess(res, user, 'Current user retrieved successfully');
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  const result = await authService.forgotPassword(email);

  sendSuccess(res, result, result.message);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body as { token: string; password: string };
  await authService.resetPassword(token, password);

  sendSuccess(res, null, 'Password reset successfully');
});

export const getGoogleAuthUrl = asyncHandler(async (_req: Request, res: Response) => {
  const result = authService.getGoogleAuthUrl();

  sendSuccess(res, result, result.message);
});

export const googleSignIn = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken: string };
  const result = await authService.googleSignIn(idToken);

  sendSuccess(res, result, 'Logged in with Google successfully');
});

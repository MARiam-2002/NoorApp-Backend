import type { Request, Response } from 'express';

import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import * as authService from '../services/auth.service';
import * as registration from '../services/email-registration.service';

export const signUp = asyncHandler(async (req: Request, res: Response) => {
  const { username, fullName, email, password } = req.body as {
    username?: string | null;
    fullName?: string | null;
    email: string;
    password: string;
  };
  const result = await registration.beginEmailRegistration({
    ...(username ? { username } : {}),
    ...(fullName ? { fullName } : {}),
    email,
    password,
  });

  sendSuccess(res, result, 'Check your email to complete registration', req, HttpStatus.ACCEPTED);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const result = await authService.login({ email, password });

  sendSuccess(res, result, 'Logged in successfully', req);
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body as { refreshToken: string };
  const result = await authService.refreshToken({ refreshToken: token });

  sendSuccess(res, result, 'Token refreshed successfully', req);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: token, fcmToken } = req.body as { refreshToken: string; fcmToken?: string };
  await authService.logout({ refreshToken: token, fcmToken });

  sendSuccess(res, null, 'Logged out successfully', req);
});

export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const result = await authService.deleteAccount(userId);

  sendSuccess(res, result, 'Account deleted', req);
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

  sendSuccess(res, user, 'Current user retrieved successfully', req);
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  await authService.forgotPassword(email);

  sendSuccess(
    res,
    null,
    'If an account exists for this email, a password reset link has been sent',
    req,
  );
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password, newPassword } = req.body as {
    token: string;
    password?: string;
    newPassword?: string;
  };
  await authService.resetPassword(token, password ?? newPassword ?? '');

  sendSuccess(res, null, 'Password reset successfully', req);
});

export const getGoogleAuthUrl = asyncHandler(async (req: Request, res: Response) => {
  const result = authService.getGoogleAuthUrl();

  sendSuccess(res, result, result.message, req);
});

export const googleSignIn = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken: string };
  const result = await authService.googleSignIn(idToken);

  sendSuccess(res, result, 'Logged in with Google successfully', req);
});

export const verifyEmail = asyncHandler(async (req: Request,res: Response) => { const result=await registration.verifyEmailRegistration(req.body.verificationId,req.body.code); sendSuccess(res,result,'Email verified. Please log in.',req); });
export const resendVerification = asyncHandler(async (req: Request,res: Response) => { const result=await registration.resendEmailVerification(req.body.verificationId); sendSuccess(res,result,'Verification email sent',req,HttpStatus.ACCEPTED); });

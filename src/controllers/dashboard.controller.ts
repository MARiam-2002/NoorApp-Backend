import type { Request, Response } from 'express';

import { asyncHandler, sendSuccess } from '../middleware/common';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import * as dashboardService from '../services/dashboard.service';

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const data = await dashboardService.getDashboard(userId);

  sendSuccess(res, data, 'Dashboard loaded successfully');
});

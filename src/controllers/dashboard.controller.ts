import type { Request, Response } from 'express';

import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import * as dashboardService from '../services/dashboard.service';
import { getContinuitySummaryForHome } from '../services/continuity.service';

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const data = await dashboardService.getDashboard(userId);

  const continuity = await getContinuitySummaryForHome(userId);
  sendSuccess(res, { ...data, continuity }, 'Dashboard loaded successfully', req);
});

import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendPaginated, sendSuccess } from '../shared/utils/response';
import { getUserAyah, getUserAyahHistory } from '../services/ayah.service';

export const getAyahHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const sessionId = req.headers['x-noor-app-open-id'] as string;
  const data = await getUserAyah(userId, sessionId);
  sendSuccess(res, data, 'Ayah retrieved successfully', req);
});

export const getAyahHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { page, limit } = req.query as { page?: string; limit?: string };
  const result = await getUserAyahHistory(
    userId,
    page ? Number(page) : undefined,
    limit ? Number(limit) : undefined,
  );
  sendPaginated(res, result.items, result.meta, 'Ayah history retrieved successfully', req);
});

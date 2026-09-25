import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { getDayOfYear } from '../utils/date';
import {
  answerStance,
  getNextStanceForUser,
  getStanceByIdForUser,
  getTodayStance,
  listStanceCatalogLite,
} from '../services/stance.service';

export const stanceAnswerBodySchema = z.object({
  selectedOptionKey: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(['A', 'B', 'C'])),
});

export const getTodayStanceHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  const dayRaw = req.query.dayOfYear != null ? Number(req.query.dayOfYear) : getDayOfYear();
  const data = await getTodayStance(userId, dayRaw);
  sendSuccess(res, data, 'Today stance situation retrieved successfully', req);
});

export const getStanceByIdHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  const id = String(req.params.id || '');
  const data = await getStanceByIdForUser(id, userId);
  sendSuccess(res, data, 'Stance situation retrieved successfully', req);
});

export const getNextStanceHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  const afterId = String(req.query.afterId || req.query.after || '');
  if (!afterId.trim()) {
    const data = await getTodayStance(userId);
    sendSuccess(res, data, 'Stance situation retrieved successfully', req);
    return;
  }
  const data = await getNextStanceForUser(afterId, userId);
  sendSuccess(res, data, 'Next stance situation retrieved successfully', req);
});

export const listStancesHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await listStanceCatalogLite();
  sendSuccess(res, data, 'Stance catalog listed successfully', req);
});

export const answerStanceHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  const situationId = String(req.params.id || '');
  const body = req.body as z.infer<typeof stanceAnswerBodySchema>;
  const data = await answerStance({
    userId,
    situationId,
    selectedOptionKey: body.selectedOptionKey,
  });
  sendSuccess(
    res,
    data,
    data.alreadyAnswered
      ? 'Stance already answered; returning saved reveal'
      : 'Stance answered successfully',
    req,
  );
});

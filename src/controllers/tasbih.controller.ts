import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { HttpStatus } from '../config';
import {
  getTodayTasbih,
  incrementTasbih,
  resetTasbih,
  changeDhikr,
  getTasbihHistory,
  getDhikrArName,
  listTasbihsForViewer,
  addUserTasbih,
  removeUserTasbih,
} from '../services/tasbih.service';

const DAILY_TASBIH_GOAL = 99;

function enrichTasbihResponse(result: { dhikr: string; count: number; [k: string]: unknown }) {
  return {
    ...result,
    dhikrAr: getDhikrArName(result.dhikr),
    dailyGoal: DAILY_TASBIH_GOAL,
    progressPercent: Math.min(100, Math.round((result.count / DAILY_TASBIH_GOAL) * 100)),
  };
}

/**
 * GET /tasbihs — public catalog; when Bearer is valid, append that user's customs only.
 * User id always comes from `req.user.sub` (token), never from the client body.
 */
export const listTasbihsHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  const items = await listTasbihsForViewer(userId);
  sendSuccess(
    res,
    items,
    userId ? 'Tasbih list retrieved successfully' : 'Tasbih catalog retrieved successfully',
    req,
  );
});

/** POST /tasbihs — add a custom phrase to the logged-in user's personal list. */
export const addUserTasbihHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { text, count } = req.body as { text: string; count?: number | null };
  const data = await addUserTasbih(userId, { text, count });
  sendSuccess(res, data, 'Custom tasbih added to your list', req, HttpStatus.CREATED);
});

/** DELETE /tasbihs/:id — remove a custom phrase from the logged-in user's personal list. */
export const removeUserTasbihHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const id = String(req.params.id ?? '');
  const data = await removeUserTasbih(userId, id);
  sendSuccess(res, data, 'Custom tasbih removed from your list', req);
});

export const getTodayHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const result = await getTodayTasbih(userId);
  sendSuccess(res, enrichTasbihResponse(result), 'Today tasbih retrieved successfully', req);
});

export const incrementHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { amount } = req.body as { amount?: number };
  const result = await incrementTasbih(userId, amount ?? 1);
  sendSuccess(res, enrichTasbihResponse(result), 'Tasbih incremented successfully', req);
});

export const resetTodayHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const result = await resetTasbih(userId);
  sendSuccess(res, enrichTasbihResponse(result), 'Today tasbih reset successfully', req);
});

export const changeDhikrHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { dhikr } = req.body as { dhikr: any };
  const result = await changeDhikr(userId, dhikr);
  sendSuccess(res, enrichTasbihResponse(result), 'Dhikr changed successfully', req);
});

export const getHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { limit } = req.query as unknown as { limit?: number };
  const history = await getTasbihHistory(userId, limit ?? 30);

  sendSuccess(
    res,
    history.map((log) => ({
      ...log,
      dhikrAr: getDhikrArName(log.dhikr),
    })),
    'Tasbih history retrieved successfully',
    req,
  );
});

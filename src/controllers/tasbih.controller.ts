import type { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../middleware/common';
import {
  getTodayTasbih,
  incrementTasbih,
  resetTasbih,
  changeDhikr,
  getTasbihHistory,
  getDhikrArName,
} from '../services/tasbih.service';

export const getTodayHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const result = await getTodayTasbih(userId);

  sendSuccess(
    res,
    {
      ...result,
      dhikrAr: getDhikrArName(result.dhikr),
    },
    'Today tasbih retrieved successfully',
  );
});

export const incrementHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { amount } = req.body as { amount?: number };
  const result = await incrementTasbih(userId, amount ?? 1);

  sendSuccess(
    res,
    {
      ...result,
      dhikrAr: getDhikrArName(result.dhikr),
    },
    'Tasbih incremented successfully',
  );
});

export const resetTodayHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const result = await resetTasbih(userId);

  sendSuccess(
    res,
    {
      ...result,
      dhikrAr: getDhikrArName(result.dhikr),
    },
    'Today tasbih reset successfully',
  );
});

export const changeDhikrHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { dhikr } = req.body as { dhikr: any };
  const result = await changeDhikr(userId, dhikr);

  sendSuccess(
    res,
    {
      ...result,
      dhikrAr: getDhikrArName(result.dhikr),
    },
    'Dhikr changed successfully',
  );
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
  );
});

import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import {
  getAllCategories,
  getCategoriesWithDailyWird,
  getCategoryWithItems,
  getDailyWird,
} from '../services/adhkar.service';

export const getDhikrCategoriesHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await getAllCategories();
  sendSuccess(res, data, 'Dhikr categories retrieved successfully', req);
});

export const getDhikrHomeHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await getCategoriesWithDailyWird();
  sendSuccess(res, data, 'Dhikr home (categories + daily wird) retrieved successfully', req);
});

export const getDhikrCategoryByKeyHandler = asyncHandler(async (req: Request, res: Response) => {
  const key = String(req.params.key ?? '');
  const data = await getCategoryWithItems(key);
  sendSuccess(res, data, `Dhikr category ${key} retrieved successfully`, req);
});

export const getDailyWirdHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await getDailyWird();
  sendSuccess(res, data, 'Daily wird (ورد اليوم) retrieved successfully', req);
});

import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { HttpStatus } from '../shared/constants';
import {
  getAllCategories,
  getCategoriesWithDailyWird,
  getCategoryWithItems,
  getDailyWird,
  getAdhkarProgress,
  saveAdhkarProgress,
  listAdhkarFavorites,
  addAdhkarFavorite,
  removeAdhkarFavorite,
  searchAdhkar,
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

export const getAdhkarProgressHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const categoryKey = String(req.query.categoryKey ?? req.query.category ?? 'MORNING');
  const data = await getAdhkarProgress(userId, categoryKey);
  sendSuccess(res, data, `Adhkar progress for ${categoryKey} retrieved`, req);
});

export const saveAdhkarProgressHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { categoryKey, itemId, tapCount } = req.body as {
    categoryKey: string;
    itemId: string;
    tapCount: number;
  };
  const data = await saveAdhkarProgress(userId, categoryKey, itemId, tapCount);
  sendSuccess(res, data, `Adhkar progress saved for ${categoryKey}`, req);
});


export const listAdhkarFavoritesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const data = await listAdhkarFavorites(userId);
  sendSuccess(res, data, 'Adhkar favorites retrieved successfully', req);
});

export const addAdhkarFavoriteHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { itemId } = req.body as { itemId: string };
  const data = await addAdhkarFavorite(userId, itemId);
  sendSuccess(res, data, 'Dhikr added to favorites', req, HttpStatus.CREATED);
});

export const removeAdhkarFavoriteHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { favoriteId } = req.params as { favoriteId: string };
  const data = await removeAdhkarFavorite(userId, favoriteId);
  sendSuccess(res, data, 'Favorite removed successfully', req);
});

export const searchAdhkarHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = String(req.query.q ?? req.query.query ?? '');
  const categoryKey = req.query.categoryKey ? String(req.query.categoryKey) : undefined;
  const limitRaw = Number(req.query.limit ?? req.query.perPage ?? 50);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.round(limitRaw) : 50;

  const data = await searchAdhkar(query, { limit, categoryKey });
  sendSuccess(
    res,
    data,
    query.length > 0
      ? `Adhkar search results for "${query}" retrieved successfully`
      : 'Adhkar search (empty query) — no results',
    req,
  );
});

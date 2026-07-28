import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { HttpStatus } from '../config';
import { sendPaginated, sendSuccess } from '../shared/utils/response';
import {
  listSurahs,
  getSurah,
  listAyahs,
  listBookmarks,
  createBookmark,
  deleteBookmark,
  getLastRead,
  updateLastRead,
  listReadingHistory,
  recordReadingHistory,
  getKhatmah,
  updateKhatmah,
} from '../services/quran.service';

export const listSurahsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listSurahs();
  sendSuccess(res, data, 'Surahs retrieved successfully', _req);
});

export const getSurahHandler = asyncHandler(async (req: Request, res: Response) => {
  const { surahId } = req.params as { surahId: string };
  const data = await getSurah(Number(surahId));
  sendSuccess(res, data, 'Surah retrieved successfully', req);
});

export const listAyahsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { surahId } = req.params as { surahId: string };
  const { page, limit } = req.query as { page?: number; limit?: number };
  const result = await listAyahs(Number(surahId), page, limit);
  sendPaginated(res, result.items, result.meta, 'Ayahs retrieved successfully', req);
});

export const listBookmarksHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const data = await listBookmarks(userId);
  sendSuccess(res, data, 'Bookmarks retrieved successfully', req);
});

export const createBookmarkHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { surahId, ayahNumber, note } = req.body as {
    surahId: number;
    ayahNumber: number;
    note?: string;
  };
  const data = await createBookmark(userId, surahId, ayahNumber, note);
  sendSuccess(res, data, 'Bookmark created successfully', req, HttpStatus.CREATED);
});

export const deleteBookmarkHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { bookmarkId } = req.params as { bookmarkId: string };
  await deleteBookmark(userId, bookmarkId);
  sendSuccess(res, null, 'Bookmark deleted successfully', req);
});

export const getLastReadHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const data = await getLastRead(userId);
  sendSuccess(res, data, 'Last read position retrieved successfully', req);
});

export const updateLastReadHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { surahId, ayahNumber, page } = req.body as {
    surahId: number;
    ayahNumber: number;
    page?: number;
  };
  const data = await updateLastRead(userId, surahId, ayahNumber, page);
  sendSuccess(res, data, 'Last read position updated successfully', req);
});

export const listReadingHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { page, limit } = req.query as { page?: number; limit?: number };
  const result = await listReadingHistory(userId, page, limit);
  sendPaginated(res, result.items, result.meta, 'Reading history retrieved successfully', req);
});

export const recordReadingHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { surahId, ayahFrom, ayahTo, page } = req.body as {
    surahId: number;
    ayahFrom: number;
    ayahTo: number;
    page?: number;
  };
  const data = await recordReadingHistory(userId, surahId, ayahFrom, ayahTo, page);
  sendSuccess(res, data, 'Reading session recorded successfully', req, HttpStatus.CREATED);
});

export const getKhatmahHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const data = await getKhatmah(userId);
  sendSuccess(res, data, 'Khatmah progress retrieved successfully', req);
});

export const updateKhatmahHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { surahId, page, pagesRead } = req.body as {
    surahId: number;
    page: number;
    pagesRead?: number;
  };
  const data = await updateKhatmah(userId, surahId, page, pagesRead ?? 1);
  sendSuccess(res, data, 'Khatmah progress updated successfully', req);
});

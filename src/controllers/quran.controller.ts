import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { HttpStatus } from '../config';
import { sendPaginated, sendSuccess } from '../shared/utils/response';
import { sendJsonWithRange } from '../lib/http-range';
import {
  listSurahs,
  getSurah,
  listAyahs,
  listBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  getLastRead,
  updateLastRead,
  listReadingHistory,
  recordReadingHistory,
  getKhatmah,
  updateKhatmah,
  resetKhatmah,
  listJuz,
  listJuzSurahs,
  listAyahsByPage,
  getKhatmahWithStats,
  searchQuran,
  getRandomAyah,
  getFullQuranCatalog,
  listAyahsByJuz,
  importLocalData,
  listReciters,
  listTafsirs,
  listTranslations,
  getAyahAudio,
  getAyahTafsir,
  getAyahTranslation,
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
  const { page, perPage } = req.query as { page?: number; perPage?: number };
  const result = await listAyahs(Number(surahId), page, perPage);
  sendPaginated(res, result.items, result.meta, 'Ayahs retrieved successfully', req);
});

export const listBookmarksHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const data = await listBookmarks(userId);
  sendSuccess(res, data, 'Bookmarks retrieved successfully', req);
});

export const createBookmarkHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { surahId, ayahNumber, note, page } = req.body as {
    surahId: number;
    ayahNumber?: number;
    note?: string;
    page?: number;
  };
  const data = await createBookmark(userId, surahId, ayahNumber, note, page);
  sendSuccess(res, data, 'Bookmark created successfully', req, HttpStatus.CREATED);
});

export const updateBookmarkHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { bookmarkId } = req.params as { bookmarkId: string };
  const { note } = req.body as { note: string };
  const data = await updateBookmark(userId, bookmarkId, note ?? '');
  sendSuccess(res, data, 'Bookmark updated successfully', req);
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
    ayahNumber?: number;
    page?: number;
  };
  const data = await updateLastRead(userId, surahId, ayahNumber ?? 1, page);
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
  const { surahId, fromAyah, toAyah, pagesRead } = req.body as {
    surahId: number;
    fromAyah?: number;
    toAyah?: number;
    pagesRead: number;
  };
  const ayahFrom = fromAyah ?? 1;
  const ayahTo = toAyah ?? ayahFrom;
  const data = await recordReadingHistory(userId, surahId, ayahFrom, ayahTo, pagesRead);
  sendSuccess(res, data, 'Reading session recorded successfully', req, HttpStatus.CREATED);
});

export const getKhatmahHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const data = await getKhatmah(userId);
  sendSuccess(res, data, 'Khatmah progress retrieved successfully', req);
});

export const updateKhatmahHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { surahId, currentPage, pagesRead } = req.body as {
    surahId: number;
    currentPage: number;
    pagesRead?: number;
  };
  const data = await updateKhatmah(userId, surahId, currentPage, pagesRead ?? 1);
  sendSuccess(res, data, 'Khatmah progress updated successfully', req);
});

export const resetKhatmahHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const data = await resetKhatmah(userId);
  sendSuccess(res, data, 'Khatmah reset successfully — new khatmah started at Al-Baqarah page 1', req);
});

// ============================================================
//  NEW: Juz (الأجزاء) + Quran page reader + Khatmah stats
// ============================================================

export const listJuzHandler = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listJuz();
  sendSuccess(res, data, 'Juz list retrieved successfully', _req);
});

export const listJuzSurahsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { juzNumber } = req.params as { juzNumber: string };
  const data = await listJuzSurahs(Number(juzNumber));
  sendSuccess(res, data, `Juz ${juzNumber} surahs retrieved successfully`, req);
});

export const listAyahsByPageHandler = asyncHandler(async (req: Request, res: Response) => {
  const { pageNumber } = req.params as { pageNumber: string };
  const data = await listAyahsByPage(Number(pageNumber));
  sendSuccess(res, data, `Quran page ${pageNumber} retrieved successfully`, req);
});

export const getKhatmahStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const data = await getKhatmahWithStats(userId);
  sendSuccess(res, data, 'Khatmah with stats retrieved successfully', req);
});

// ============================================================
//  NEW (Round 2): Bookmarks patch, Khatmah reset, Quran Search, Random Ayah
// ============================================================

export const searchQuranHandler = asyncHandler(async (req: Request, res: Response) => {
  const { q, page, limit } = req.query as { q?: string; page?: string; limit?: string };
  const data = await searchQuran(
    q ?? '',
    page ? Number(page) : undefined,
    limit ? Number(limit) : undefined,
  );
  sendSuccess(res, data, `Quran search for "${data.query}" completed (${data.total} matches)`, req);
});

export const getRandomAyahHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await getRandomAyah();
  sendSuccess(res, data, `Random ayah from ${data.surah?.nameAr ?? '?'}:${data.ayah.ayahNumber} retrieved successfully`, req);
});

// ============================================================
//  NEW: Offline Catalog endpoints (Full Quran Download + Juz Ayahs)
// ============================================================

export const getFullQuranCatalogHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await getFullQuranCatalog();
  // Support HTTP Range for resume-capable offline downloads (contract §3)
  sendJsonWithRange(
    req,
    res,
    data,
    `Full Quran catalog ready for offline download (${data.meta.totalAyahs} ayahs, ${data.meta.totalSurahs} surahs)`,
  );
});

export const listAyahsByJuzHandler = asyncHandler(async (req: Request, res: Response) => {
  const { juzNumber } = req.params as { juzNumber: string };
  const data = await listAyahsByJuz(Number(juzNumber));
  sendSuccess(
    res,
    data,
    `Juz ${juzNumber} ayahs retrieved successfully (${data.totalAyahs} ayahs)`,
    req,
  );
});

// ============================================================
//  NEW: Guest Data Merge (Contract §4, §13)
// ============================================================

export const importLocalDataHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { bookmarks, lastRead } = req.body as {
    bookmarks?: Array<{
      surahId: number;
      ayahNumber?: number;
      page?: number;
      note?: string;
    }>;
    lastRead?: {
      surahId: number;
      page: number;
      ayahNumber?: number;
    };
  };

  const data = await importLocalData(userId, { bookmarks, lastRead });
  sendSuccess(res, data, data.message, req);
});

export const listRecitersHandler = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listReciters();
  sendSuccess(res, data, 'Quran reciter options retrieved successfully', _req);
});

export const listTafsirsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listTafsirs();
  sendSuccess(res, data, 'Quran tafsir options retrieved successfully', _req);
});

export const listTranslationsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listTranslations();
  sendSuccess(res, data, 'Quran translation options retrieved successfully', _req);
});

export const getAyahAudioHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as {
    surahId: string;
    ayahNumber: string;
    reciter?: string;
    reciterId?: string;
    id?: string;
  };
  const reciter = q.reciter ?? q.reciterId ?? q.id;
  const data = await getAyahAudio(Number(q.surahId), Number(q.ayahNumber), reciter);
  sendSuccess(res, data, 'Quran audio URL generated successfully', req);
});

export const getAyahTafsirHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as {
    surahId: string;
    ayahNumber: string;
    source?: string;
    tafsirId?: string;
    id?: string;
  };
  const source = q.source ?? q.tafsirId ?? q.id;
  const data = await getAyahTafsir(Number(q.surahId), Number(q.ayahNumber), source);
  sendSuccess(res, data, 'Quran tafsir retrieved successfully', req);
});

export const getAyahTranslationHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as {
    surahId: string;
    ayahNumber: string;
    source?: string;
    translationId?: string;
    id?: string;
  };
  const source = q.source ?? q.translationId ?? q.id;
  const data = await getAyahTranslation(Number(q.surahId), Number(q.ayahNumber), source);
  sendSuccess(res, data, 'Quran translation retrieved successfully', req);
});

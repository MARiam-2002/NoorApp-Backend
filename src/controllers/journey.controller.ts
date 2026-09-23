import type { Request, Response } from 'express';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import {
  getTodayJourney,
  getJourneyProgress as getJourneyProgressService,
  getJourneyDashboard as getJourneyDashboardService,
  getWeeklyCategorySummary as getWeeklyCategorySummaryService,
  getMonthlyCalendarHeatmap as getMonthlyCalendarHeatmapService,
  updateQuranPages,
  incrementQuranPages as incrementQuranPagesService,
  updateAdhkar,
  updateSadaqah,
  getSadaqahToday,
  togglePrayer,
} from '../services/journey.service';

export const getJourneyToday = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const data = await getTodayJourney(userId);
  sendSuccess(res, data, 'Daily journey retrieved successfully', req);
});

export const getJourneyBadges = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const today = await getTodayJourney(userId);
  sendSuccess(
    res,
    {
      badges: today.badges ?? [],
      streakDays: today.streakDays ?? 0,
      // Additive — same Journey screen fields as GET /journey/today
      streak: today.streak,
      level: today.level,
      rankTitleAr: today.rankTitleAr,
      rankTitleEn: today.rankTitleEn,
      levelProgressPercent: today.levelProgressPercent,
      points: today.points,
      pointsToNextLevel: today.pointsToNextLevel,
    },
    'Journey badges retrieved successfully',
    req,
  );
});

export const getJourneyProgress = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { days } = req.query as { days?: string };
  const daysNum = days ? Number(days) : 7;

  const data = await getJourneyProgressService(userId, daysNum);
  sendSuccess(res, data, 'Journey progress retrieved successfully', req);
});

/**
 * 🎯 MASTER ENDPOINT — Single call for the full "رحلتي" (Journey) screen.
 * Aggregates all 4 cards matching the UI screenshot:
 *   1. المستوي الحالي + 5 ميداليات
 *   2. سلسلة الحسنات (10 checkmark row)
 *   3. ملخص الاسبوع (4 colored % bars: صلاة/قرآن/صدقة/ذكر)
 *   4. الكالندر الشهري (month heatmap grid)
 * Plus todayTiles (prayers/quran/adhkar/sadaqah), dailyChallenge, badges, streakDays, points.
 * Query params (OPTIONAL):
 *   ?weekDays=N  (default 7) — days to use for weeklySummary % calculation
 *   ?month=1..12 (default this month)
 *   ?year=YYYY   (default this year)
 */
export const getJourneyDashboard = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { weekDays, month, year } = req.query as {
    weekDays?: string;
    month?: string;
    year?: string;
  };
  const weekDaysNum = weekDays ? Number(weekDays) : undefined;
  const monthNum = month ? Number(month) : undefined;
  const yearNum = year ? Number(year) : undefined;

  const data = await getJourneyDashboardService(userId, {
    weekDays: weekDaysNum,
    month: monthNum,
    year: yearNum,
  });
  sendSuccess(
    res,
    data,
    'Journey dashboard (رحلتي) — aggregated level / streak / weekly / monthly data retrieved successfully',
    req,
  );
});

/**
 * Weekly-category-percentages standalone endpoint (same sub-data as dashboard weeklySummaryCard,
 * exposed standalone for lazy-reload / card refresh without full dashboard re-fetch).
 *   ?days=7 (default) — how many days back to compute the 4 bars percentages for.
 */
export const getWeeklyCategorySummary = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  const { days } = req.query as { days?: string };
  const daysNum = days ? Number(days) : 7;

  const data = await getWeeklyCategorySummaryService(userId, daysNum);
  sendSuccess(
    res,
    data,
    'Weekly category summary (Prayers / Quran / Sadaqah / Dhikr %) retrieved successfully',
    req,
  );
});

/**
 * Monthly calendar heatmap standalone endpoint (same sub-data as dashboard monthlyCalendarCard,
 * exposed standalone for swiping prev/next months without re-fetching the dashboard).
 *   ?month=1..12 (default current month)
 *   ?year=YYYY  (default current year)
 */
export const getMonthlyCalendarHeatmap = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  const { month, year } = req.query as { month?: string; year?: string };
  const monthNum = month ? Number(month) : undefined;
  const yearNum = year ? Number(year) : undefined;

  const data = await getMonthlyCalendarHeatmapService(userId, monthNum, yearNum);
  sendSuccess(res, data, 'Monthly calendar heatmap retrieved successfully', req);
});

export const updateQuranPagesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { pages } = req.body as { pages: number };
  const data = await updateQuranPages(userId, pages);
  sendSuccess(res, data, 'Quran pages updated successfully', req);
});

export const incrementQuranPages = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { pages } = req.body as { pages?: number };
  const data = await incrementQuranPagesService(userId, pages ?? 1);
  sendSuccess(res, data, 'Quran pages incremented successfully', req);
});

export const patchAdhkar = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const body = req.body as {
    completed?: boolean;
    morningCompleted?: boolean;
    eveningCompleted?: boolean;
    categoryKey?: string;
  };
  const data = await updateAdhkar(userId, body);
  sendSuccess(res, data, 'Adhkar status updated successfully', req);
});

export const patchSadaqah = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { amount, category, mode, goal } = req.body as {
    amount?: number;
    goal?: number;
    category?: string;
    mode?: 'set' | 'add';
  };
  const data = await updateSadaqah(userId, { amount, category, mode, goal });
  sendSuccess(res, data, 'Sadaqah updated successfully', req);
});

export const getSadaqah = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const data = await getSadaqahToday(userId);
  sendSuccess(res, data, 'Sadaqah retrieved successfully', req);
});

export const patchPrayer = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!userId) {
    throw new AppError(
      'Authentication required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  const { prayer, completed } = req.body as { prayer: string; completed?: boolean };
  const data = await togglePrayer(userId, prayer, completed ?? true);
  sendSuccess(
    res,
    data,
    data.prayer.completed ? 'Prayer marked as completed successfully' : 'Prayer unmarked successfully',
    req,
  );
});

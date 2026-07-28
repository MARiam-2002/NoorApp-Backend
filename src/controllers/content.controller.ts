import type { Request, Response } from 'express';
import { HttpStatus } from '../config';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import {
  getDailyChallenge,
  getDailyChallengeByDay,
  getHadithOfDay,
  getHadithOfDayByDay,
  getVerseOfDay,
  getVerseOfDayByDay,
} from '../services/content.service';

export const getVerseOfDayHandler = asyncHandler(async (req: Request, res: Response) => {
  const { day } = req.query as { day?: string };
  const dayNum = day ? Number(day) : undefined;

  const data = dayNum ? await getVerseOfDayByDay(dayNum) : await getVerseOfDay();
  sendSuccess(res, data, 'Verse of the day retrieved successfully', req);
});

export const getHadithOfDayHandler = asyncHandler(async (req: Request, res: Response) => {
  const { day } = req.query as { day?: string };
  const dayNum = day ? Number(day) : undefined;

  const data = dayNum ? await getHadithOfDayByDay(dayNum) : await getHadithOfDay();
  sendSuccess(res, data, 'Hadith of the day retrieved successfully', req);
});

export const getDailyChallengeHandler = asyncHandler(async (req: Request, res: Response) => {
  const { day } = req.query as { day?: string };
  const dayNum = day ? Number(day) : undefined;

  const data = dayNum ? await getDailyChallengeByDay(dayNum) : await getDailyChallenge();
  sendSuccess(res, data, 'Daily challenge retrieved successfully', req);
});

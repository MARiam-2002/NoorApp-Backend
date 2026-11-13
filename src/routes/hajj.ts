import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { getLocalClock, resolveTimezone } from '../services/salawat-reminder.service';
import { isDayKey } from '../shared/utils/hijri';
import { getHajjGuide, getHajjToday } from '../services/hajj-umrah.service';

/**
 * Hajj and Umrah guide — public, no sign-in.
 * GET /hajj/guide                       everything (cache offline; refresh when `version` changes)
 * GET /hajj/today?timezone&hijriOffset  phase of the Hajj calendar and today's steps (send the fasting Hijri correction)
 */
export const hajjRouter = Router();

hajjRouter.get('/guide', asyncHandler(async (req, res) => {
  z.object({}).strict().parse(req.query);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  sendSuccess(res, getHajjGuide(), 'Hajj and Umrah guide', req);
}));

hajjRouter.get('/today', asyncHandler(async (req, res) => {
  const q = z.object({
    date: z.string().refine(isDayKey, 'date must be YYYY-MM-DD').optional(),
    timezone: z.string().max(64).optional(),
    hijriOffset: z.coerce.number().int().min(-2).max(2).default(0),
  }).strict().parse(req.query);
  const day = q.date ?? getLocalClock(new Date(), resolveTimezone(q.timezone)).dayKey;
  res.setHeader('Cache-Control', 'public, max-age=900');
  sendSuccess(res, getHajjToday(day, q.hijriOffset), 'Hajj today', req);
}));

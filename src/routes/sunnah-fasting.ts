import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/common';
import { authenticate } from '../middleware/auth';
import { sendSuccess } from '../shared/utils/response';
import { getLocalClock, resolveTimezone } from '../services/salawat-reminder.service';
import { hijriOfDayKey } from '../shared/utils/hijri';
import {
  getOccasions, getSunnahCalendar, getSunnahPreferences, getSunnahToday, updateSunnahPreferences,
} from '../services/sunnah-fasting.service';

/**
 * Sunnah fasting and occasions, inside the fasting area. Mounted on /fasting BEFORE the private qada router.
 * Public: GET /fasting/sunnah/today · /fasting/sunnah/calendar · /fasting/occasions
 * Signed in: GET|PATCH /fasting/sunnah/preferences
 * `hijriOffset` (-2..2) is the user's moon-sighting correction (send the value from the preferences).
 */
export const sunnahFastingRouter = Router();
const offset = z.coerce.number().int().min(-2).max(2).default(0);
const tz = z.string().max(64).optional();
const today = (date: string | undefined, timezone: string | undefined) => date ?? getLocalClock(new Date(), resolveTimezone(timezone)).dayKey;
const shortCache = (res: any) => res.setHeader('Cache-Control', 'public, max-age=900');

sunnahFastingRouter.get('/sunnah/today', asyncHandler(async (req, res) => {
  const q = z.object({ date: z.string().optional(), timezone: tz, hijriOffset: offset }).strict().parse(req.query);
  shortCache(res); sendSuccess(res, getSunnahToday(today(q.date, q.timezone), q.hijriOffset), 'Sunnah fasting today', req);
}));
sunnahFastingRouter.get('/sunnah/calendar', asyncHandler(async (req, res) => {
  const q = z.object({ from: z.string().optional(), days: z.coerce.number().int().default(31), timezone: tz, hijriOffset: offset }).strict().parse(req.query);
  shortCache(res); sendSuccess(res, getSunnahCalendar(today(q.from, q.timezone), q.days, q.hijriOffset), 'Sunnah fasting calendar', req);
}));
sunnahFastingRouter.get('/occasions', asyncHandler(async (req, res) => {
  const q = z.object({ hijriYear: z.coerce.number().int().optional(), timezone: tz, hijriOffset: offset }).strict().parse(req.query);
  const day = today(undefined, q.timezone);
  shortCache(res); sendSuccess(res, getOccasions(q.hijriYear ?? hijriOfDayKey(day, q.hijriOffset).year, q.hijriOffset, day), 'Islamic occasions', req);
}));

const privateCache: import('express').RequestHandler = (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); };
sunnahFastingRouter.get('/sunnah/preferences', authenticate, privateCache, asyncHandler(async (req, res) => {
  sendSuccess(res, await getSunnahPreferences(req.user!.sub), 'Sunnah fasting settings', req);
}));
sunnahFastingRouter.patch('/sunnah/preferences', authenticate, privateCache, asyncHandler(async (req, res) => {
  sendSuccess(res, await updateSunnahPreferences(req.user!.sub, req.body), 'Sunnah fasting settings saved', req);
}));

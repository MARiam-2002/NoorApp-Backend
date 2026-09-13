import { Router } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus, env } from '../config';
import { runPrayerReminderCron } from '../services/prayer-reminder.service';

export const cronRouter = Router();

/**
 * Pure cron auth check (no Vercel header bypass).
 * Empty/missing secret → never authorized.
 */
export function isCronRequestAuthorized(
  configuredSecret: string | undefined | null,
  req: {
    headers: Record<string, unknown>;
    query: Record<string, unknown>;
  },
): boolean {
  const secret = (configuredSecret || '').trim();
  if (!secret) return false;

  const header = String(req.headers['authorization'] ?? '');
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const querySecret = typeof req.query.secret === 'string' ? req.query.secret : '';
  const headerSecret = String(req.headers['x-cron-secret'] ?? '');

  return bearer === secret || querySecret === secret || headerSecret === secret;
}

function assertCronAuthorized(req: {
  headers: Record<string, unknown>;
  query: Record<string, unknown>;
}) {
  const secret = env.CRON_SECRET || process.env.CRON_SECRET || '';
  if (!isCronRequestAuthorized(secret, req)) {
    throw new AppError('Cron unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
}

/**
 * @openapi
 * /cron/prayer-reminders:
 *   post:
 *     tags: ['Cron']
 *     summary: FCM reminders cron — Azan backup + Pray-for-the-Prophet ﷺ
 *     description: |
 *       Same scheduler (~every 10 minutes). Runs Azan prayer-window pushes, then
 *       Salawat reminders (every 3h, max 5/day, quiet hours 22:00–08:00 local, preference-gated).
 *       Auth: Authorization Bearer CRON_SECRET, X-Cron-Secret, or ?secret= (no Vercel bypass).
 */
cronRouter.post(
  '/prayer-reminders',
  asyncHandler(async (req, res) => {
    assertCronAuthorized(req as any);
    const data = await runPrayerReminderCron(12);
    sendSuccess(res, data, 'Prayer reminder cron completed', req);
  }),
);

cronRouter.get(
  '/prayer-reminders',
  asyncHandler(async (req, res) => {
    assertCronAuthorized(req as any);
    const data = await runPrayerReminderCron(12);
    sendSuccess(res, data, 'Prayer reminder cron completed', req);
  }),
);

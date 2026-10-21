import { timingSafeEqual } from 'node:crypto';
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

  const expected = Buffer.from(secret);
  return [bearer, querySecret, headerSecret].some(value => {
    const provided = Buffer.from(value);
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  });
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
 *       Safety net for the in-process per-minute reminder scheduler (Railway cron ~every 10 minutes).
 *       Runs Azan, Salawat, Mulk, Duha, Qiyam and Khatmah reminders. Reminders are never sent
 *       before their local time; a missed minute is caught up within the late tolerance.
 *       Auth: Authorization Bearer CRON_SECRET, X-Cron-Secret, or ?secret= (no Vercel bypass).
 */
cronRouter.post(
  '/prayer-reminders',
  asyncHandler(async (req, res) => {
    assertCronAuthorized(req as any);
    const data = await runPrayerReminderCron('http');
    sendSuccess(res, data, 'Prayer reminder cron completed', req);
  }),
);

cronRouter.get(
  '/prayer-reminders',
  asyncHandler(async (req, res) => {
    assertCronAuthorized(req as any);
    const data = await runPrayerReminderCron('http');
    sendSuccess(res, data, 'Prayer reminder cron completed', req);
  }),
);

// Account deletion must never be exposed as a cron operation based on notification opt-out.

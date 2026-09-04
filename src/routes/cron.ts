import { Router } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { runPrayerReminderCron } from '../services/prayer-reminder.service';

export const cronRouter = Router();

function assertCronAuthorized(req: { headers: Record<string, unknown>; query: Record<string, unknown> }) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // Allow Vercel Cron without secret in preview only when unset — require in production if set
    const vercelCron = req.headers['x-vercel-cron'];
    if (vercelCron) return;
    throw new AppError('Cron unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const header = String(req.headers['authorization'] ?? '');
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const querySecret = typeof req.query.secret === 'string' ? req.query.secret : '';
  if (bearer !== secret && querySecret !== secret && req.headers['x-cron-secret'] !== secret) {
    // Vercel Cron sets x-vercel-cron: 1
    if (req.headers['x-vercel-cron']) return;
    throw new AppError('Cron unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
}

/**
 * @openapi
 * /cron/prayer-reminders:
 *   post:
 *     tags: ['Cron']
 *     summary: FCM Azan backup — send upcoming prayer pushes
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

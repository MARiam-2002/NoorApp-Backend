import type { Request, Response } from 'express';
import { z } from 'zod';
import { createReadStream, statSync } from 'node:fs';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import {
  getSalawatPreferences,
  updateSalawatPreferences,
  SALAWAT_ALLOWED_INTERVALS,
} from '../services/salawat-reminder.service';
import {
  getSalawatAudioCatalog,
  resolveSalawatMediaFile,
} from '../services/salawat-audio.service';

const hhmmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm (00:00–23:59)');

const intervalSchema = z
  .number()
  .int()
  .refine((n) => (SALAWAT_ALLOWED_INTERVALS as readonly number[]).includes(n), {
    message: 'intervalMinutes must be 30, 60, 120, or 180',
  });

export const salawatPreferencesPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    intervalMinutes: intervalSchema.optional(),
    startTime: hhmmSchema.optional(),
    endTime: hhmmSchema.optional(),
    windowStart: hhmmSchema.optional(),
    windowEnd: hhmmSchema.optional(),
  })
  .refine(
    (body) =>
      body.enabled !== undefined ||
      body.intervalMinutes !== undefined ||
      body.startTime !== undefined ||
      body.endTime !== undefined ||
      body.windowStart !== undefined ||
      body.windowEnd !== undefined,
    { message: 'At least one of enabled, intervalMinutes, startTime, endTime is required' },
  );

export const getSalawatPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const data = await getSalawatPreferences(userId);
  sendSuccess(res, data, 'Salawat reminder preferences retrieved successfully', req);
});

export const patchSalawatPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const body = req.body as z.infer<typeof salawatPreferencesPatchSchema>;
  const data = await updateSalawatPreferences(userId, {
    enabled: body.enabled,
    intervalMinutes: body.intervalMinutes,
    startTime: body.startTime ?? body.windowStart,
    endTime: body.endTime ?? body.windowEnd,
  });
  sendSuccess(res, data, 'Salawat reminder preferences updated successfully', req);
});

export const listSalawatAudioHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = getSalawatAudioCatalog(req);
  sendSuccess(res, data, 'Salawat audio catalog retrieved successfully', req);
});

export const streamSalawatMediaHandler = asyncHandler(async (req: Request, res: Response) => {
  const resolved = resolveSalawatMediaFile(String(req.params.file || ''));
  if (!resolved) {
    throw new AppError('Audio file not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  const { absolutePath, contentType, filename } = resolved;
  const stat = statSync(absolutePath);
  const total = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
      return;
    }
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : total - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= total) {
      res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
      return;
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', String(end - start + 1));
    createReadStream(absolutePath, { start, end }).pipe(res);
    return;
  }

  res.status(200);
  res.setHeader('Content-Length', String(total));
  createReadStream(absolutePath).pipe(res);
});

import type { Request, Response } from 'express';
import { createReadStream, statSync } from 'node:fs';

import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import {
  getAudioDefaults,
  listAzanSounds,
  listNotificationSounds,
  listPrayerVoiceSounds,
  resolveMediaFile,
} from '../services/azan-audio.service';
import {
  AUDIO_SOURCE_POLICY,
  DEFAULT_AZAN_SOUND_ID,
  DEFAULT_NOTIFICATION_SOUND_ID,
  FAMOUS_AZAN_VOICE_AUDIT,
} from '../shared/constants/azan-sounds';

export const listAzanSoundsHandler = asyncHandler(async (req: Request, res: Response) => {
  const sounds = listAzanSounds(req);
  const data = {
    defaultId: DEFAULT_AZAN_SOUND_ID,
    count: sounds.length,
    sounds,
    famousVoicesAudit: FAMOUS_AZAN_VOICE_AUDIT,
    sourcePolicy: {
      ...AUDIO_SOURCE_POLICY,
      note: 'Azan voices are AlAdhan Alafasy Adhans mirrored under /azan/media for reliable playback (cdn.aladhan.com can return 502). Flutter should play audioUrl/previewUrl. Priority famous muezzins without a source are in famousVoicesAudit.',
    },
  };
  sendSuccess(res, data, 'Azan sounds retrieved successfully', req);
});

export const listNotificationSoundsHandler = asyncHandler(async (req: Request, res: Response) => {
  const sounds = listNotificationSounds(req);
  const data = {
    defaultId: DEFAULT_NOTIFICATION_SOUND_ID,
    count: sounds.length,
    sounds,
    sourcePolicy: {
      provider: 'freesound_selfhosted',
      folder: 'assets/notification',
      note: 'GET /azan/notification-sounds lists ONLY tones from assets/notification/*.mp3 (+ silent). Near-prayer (assets/near-prayer) and prayer-event (assets/prayer-events) clips are separate catalogs.',
    },
  };
  sendSuccess(res, data, 'Notification sounds retrieved successfully', req);
});

export const listPrayerVoiceSoundsHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, listPrayerVoiceSounds(req), 'Prayer voice sounds retrieved successfully', req);
});

export const getAudioDefaultsHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = getAudioDefaults(req);
  sendSuccess(res, data, 'Default audio preferences retrieved successfully', req);
});

/**
 * Stream a self-hosted, license-cleared audio file.
 * Supports Range requests for Flutter seek/preview.
 */
export const streamAzanMediaHandler = asyncHandler(async (req: Request, res: Response) => {
  const resolved = resolveMediaFile(String(req.params.file || ''));
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
    const suffix = !match[1];
    const suffixLength = match[2] ? Number(match[2]) : NaN;
    const start = suffix ? Math.max(0, total - suffixLength) : Number(match[1]);
    const end = suffix || !match[2] ? total - 1 : Math.min(Number(match[2]), total - 1);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 ||
        start >= total || start > end || (suffix && (!Number.isSafeInteger(suffixLength) || suffixLength <= 0))) {
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

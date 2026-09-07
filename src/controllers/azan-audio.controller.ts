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
      note: 'Production Azan options are license-cleared Commons recordings (self-hosted). Famous Haramain/Egyptian voices remain blocked until written commercial-app rights are obtained — see famousVoicesAudit.',
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
      note: 'Calm spiritual reminder tones (CC0 / CC BY), self-hosted. Generic game/UI beeps removed from the live catalog.',
    },
  };
  sendSuccess(res, data, 'Notification sounds retrieved successfully', req);
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

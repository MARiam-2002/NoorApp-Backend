import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import {
  getAudioDefaults,
  listAzanSounds,
  listNotificationSounds,
} from '../services/azan-audio.service';

export const listAzanSoundsHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = {
    defaultId: 'makkah',
    count: listAzanSounds().length,
    sounds: listAzanSounds(),
  };
  sendSuccess(res, data, 'Azan sounds retrieved successfully', req);
});

export const listNotificationSoundsHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = {
    defaultId: 'beep_short',
    count: listNotificationSounds().length,
    sounds: listNotificationSounds(),
  };
  sendSuccess(res, data, 'Notification sounds retrieved successfully', req);
});

export const getAudioDefaultsHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = getAudioDefaults();
  sendSuccess(res, data, 'Default audio preferences retrieved successfully', req);
});

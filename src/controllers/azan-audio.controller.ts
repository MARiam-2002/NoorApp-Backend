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
    defaultId: 'beautiful_adhan',
    count: listAzanSounds().length,
    sounds: listAzanSounds(),
    sourcePolicy: {
      provider: 'wikimedia_commons',
      note: 'Only license-cleared Adhan recordings (CC0 / CC BY-SA). Al Furqan/Assabile, IslamCan, and Kiwifu catalogs are not used.',
    },
  };
  sendSuccess(res, data, 'Azan sounds retrieved successfully', req);
});

export const listNotificationSoundsHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = {
    defaultId: 'soft_chime',
    count: listNotificationSounds().length,
    sounds: listNotificationSounds(),
    sourcePolicy: {
      provider: 'freesound',
      note: 'Only CC0 / CC BY notification tones. Google Actions library is not used (platform-restricted).',
    },
  };
  sendSuccess(res, data, 'Notification sounds retrieved successfully', req);
});

export const getAudioDefaultsHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = getAudioDefaults();
  sendSuccess(res, data, 'Default audio preferences retrieved successfully', req);
});

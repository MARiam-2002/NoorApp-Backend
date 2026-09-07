import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import {
  getAzanPreferences,
  updateAzanPreferences,
  azanPreferencesSchema,
  type AzanPreferences,
} from '../services/azan.service';
import { getAudioDefaults } from '../services/azan-audio.service';

export const getAzanPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    // Guests: return catalog defaults (no persistence).
    const defaults = getAudioDefaults();
    sendSuccess(
      res,
      {
        azanEnabled: true,
        soundEnabled: true,
        vibrationEnabled: true,
        voiceId: defaults.voiceId,
        azanSoundId: defaults.azanSoundId,
        notificationSoundId: defaults.notificationSoundId,
        azanSound: defaults.azanSound,
        notificationSound: defaults.notificationSound,
        calculationMethod: 'EGYPT',
        madhab: 'SHAFI',
        preReminderMinutes: 15,
        preReminderEnabled: true,
        prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
        isGuestDefaults: true,
      },
      'Default Azan audio preferences (guest)',
      req,
    );
    return;
  }
  const data = await getAzanPreferences(userId);
  sendSuccess(res, data, 'Azan preferences retrieved successfully', req);
});

export const patchAzanPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    throw new AppError(
      'Authentication required to save Azan audio preferences',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  // Accept either voiceId or azanSoundId for selecting Azan audio.
  const parsed = azanPreferencesSchema.partial().parse(body);
  if (typeof body.azanSoundId === 'string' && body.azanSoundId.trim()) {
    (parsed as any).azanSoundId = body.azanSoundId;
  }
  const data = await updateAzanPreferences(userId, parsed as Partial<AzanPreferences>);
  sendSuccess(res, data, 'Azan preferences updated successfully', req);
});

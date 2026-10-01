import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import {
  CALCULATION_METHODS_CATALOG,
  MADHABS_CATALOG,
  DEFAULT_PRAYER_LOCATION,
} from '../shared/constants/default-location';
import {
  getAzanPreferences,
  updateAzanPreferences,
  pickExplicitAzanPatch,
  DEFAULT_PRE_REMINDER_MINUTES,
} from '../services/azan.service';
import { getAudioDefaults } from '../services/azan-audio.service';

/**
 * GET /azan/calculation-methods
 * Public catalog — Flutter builds the "Calculation Method" dropdown picker from this list.
 * Returns the canonical methods sorted with EN/AR labels, aliases, region hints,
 * and the product default (AUTO = official method of the user's country) marked with isDefault=true.
 */
export const listCalculationMethodsHandler = asyncHandler(async (req: Request, res: Response) => {
  const sorted = [...CALCULATION_METHODS_CATALOG].sort((a, b) => a.sortOrder - b.sortOrder);
  sendSuccess(
    res,
    {
      count: sorted.length,
      defaultId: DEFAULT_PRAYER_LOCATION.calculationMethod,
      methods: sorted,
      note:
        'Use the short `id` field as the canonical key in query params and when saving preferences. AUTO (default) applies the official method of the country at the saved location (e.g. Umm Al-Qura in Saudi Arabia); prayer responses expose the resolved method. Legacy long ids (EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY) are still accepted.',
    },
    'Prayer calculation methods catalog retrieved successfully',
    req,
  );
});

/**
 * GET /azan/madhabs
 * Public catalog — Flutter builds the "Asr Madhab" dropdown picker from this list.
 * Returns SHAFI (default, earlier Asr) and HANAFI (later Asr).
 */
export const listMadhabsHandler = asyncHandler(async (req: Request, res: Response) => {
  const sorted = [...MADHABS_CATALOG].sort((a, b) => a.sortOrder - b.sortOrder);
  sendSuccess(
    res,
    {
      count: sorted.length,
      defaultId: DEFAULT_PRAYER_LOCATION.madhab,
      madhabs: sorted,
      note:
        'Use the uppercase `id` field (SHAFI or HANAFI) as the canonical key in query params and when saving preferences. Both cases accepted, normalized internally to uppercase.',
    },
    'Asr madhabs catalog retrieved successfully',
    req,
  );
});

export const getAzanPreferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    // Guests: return catalog defaults (no persistence).
    const defaults = getAudioDefaults(req);
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
        calculationMethod: DEFAULT_PRAYER_LOCATION.calculationMethod,
        effectiveCalculationMethod: 'EGYPT',
        calculationMethodSource: 'auto',
        madhab: 'SHAFI',
        preReminderMinutes: DEFAULT_PRE_REMINDER_MINUTES,
        reminderMinutes: DEFAULT_PRE_REMINDER_MINUTES,
        prePrayerReminderMinutes: DEFAULT_PRE_REMINDER_MINUTES,
        preReminderEnabled: true,
        prePrayerReminderEnabled: true,
        prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
        fcmPrayerBackupEnabled: true,
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
  const body = { ...((req.body ?? {}) as Record<string, unknown>) };
  // Accept Flutter aliases before zod parse.
  if (body.preReminderMinutes == null) {
    if (body.prePrayerReminderMinutes != null) {
      body.preReminderMinutes = body.prePrayerReminderMinutes;
    } else if (body.reminderMinutes != null) {
      body.preReminderMinutes = body.reminderMinutes;
    }
  }
  if (body.preReminderEnabled == null && body.prePrayerReminderEnabled != null) {
    body.preReminderEnabled = body.prePrayerReminderEnabled;
  }
  const parsed = pickExplicitAzanPatch(body);
  if (typeof body.azanSoundId === 'string' && body.azanSoundId.trim()) {
    (parsed as any).azanSoundId = body.azanSoundId;
  }
  const data = await updateAzanPreferences(userId, parsed);
  sendSuccess(res, data, 'Azan preferences updated successfully', req);
});

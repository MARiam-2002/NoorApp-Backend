import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { DEFAULT_PRAYER_LOCATION } from '../shared/constants/default-location';
import {
  DEFAULT_AZAN_SOUND_ID,
  DEFAULT_NOTIFICATION_SOUND_ID,
  getAzanSoundById,
  getNotificationSoundById,
  resolveAzanSoundId,
  resolveNotificationSoundId,
  type AzanSoundOption,
  type NotificationSoundOption,
} from '../shared/constants/azan-sounds';

const prayerTogglesSchema = z.object({
  fajr: z.boolean(),
  dhuhr: z.boolean(),
  asr: z.boolean(),
  maghrib: z.boolean(),
  isha: z.boolean(),
});

export const azanPreferencesSchema = z.object({
  azanEnabled: z.boolean().default(true),
  soundEnabled: z.boolean().default(true),
  vibrationEnabled: z.boolean().default(true),
  /** Preferred Azan sound id (legacy field name kept for Flutter compatibility). */
  voiceId: z.string().trim().min(1).max(64).default(DEFAULT_AZAN_SOUND_ID),
  /** Preferred Azan sound id (alias of voiceId). */
  azanSoundId: z.string().trim().min(1).max(64).optional(),
  /** Short tone for pre-reminder / prayer notification. */
  notificationSoundId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .default(DEFAULT_NOTIFICATION_SOUND_ID),
  calculationMethod: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .default(DEFAULT_PRAYER_LOCATION.calculationMethod),
  madhab: z.enum(['SHAFI', 'HANAFI', 'shafi', 'hanafi']).default('SHAFI'),
  preReminderMinutes: z.coerce.number().int().min(0).max(120).default(15),
  preReminderEnabled: z.boolean().default(true),
  prayers: prayerTogglesSchema.default({
    fajr: true,
    dhuhr: true,
    asr: true,
    maghrib: true,
    isha: true,
  }),
  lastLat: z.number().min(-90).max(90).nullable().optional(),
  lastLng: z.number().min(-180).max(180).nullable().optional(),
  lastLocationLabel: z.string().trim().max(200).nullable().optional(),
  fcmPrayerBackupEnabled: z.boolean().default(true),
  /** Present on GET responses when Backend filled Cairo defaults. */
  isDefaultLocation: z.boolean().optional(),
  locationSource: z.enum(['default_cairo', 'profile', 'query']).optional(),
});

export type AzanPreferences = z.infer<typeof azanPreferencesSchema>;

export type AzanPreferencesResponse = AzanPreferences & {
  azanSoundId: string;
  azanSound: AzanSoundOption;
  notificationSound: NotificationSoundOption;
};

export function defaultAzanPreferences(): AzanPreferences {
  return azanPreferencesSchema.parse({});
}

function normalizePrefs(raw: unknown): AzanPreferences {
  const base = defaultAzanPreferences();
  if (!raw || typeof raw !== 'object') return base;
  const incoming = { ...(raw as Record<string, unknown>) };

  // Prefer explicit azanSoundId when patching; keep voiceId in sync.
  if (typeof incoming.azanSoundId === 'string' && incoming.azanSoundId.trim()) {
    incoming.voiceId = resolveAzanSoundId(incoming.azanSoundId);
    incoming.azanSoundId = incoming.voiceId;
  } else if (typeof incoming.voiceId === 'string' && incoming.voiceId.trim()) {
    incoming.voiceId = resolveAzanSoundId(incoming.voiceId);
    incoming.azanSoundId = incoming.voiceId;
  }

  if (typeof incoming.notificationSoundId === 'string') {
    incoming.notificationSoundId = resolveNotificationSoundId(
      incoming.notificationSoundId,
    );
  }

  const merged = { ...base, ...incoming };
  if (merged.madhab && typeof merged.madhab === 'string') {
    merged.madhab = merged.madhab.toUpperCase() as AzanPreferences['madhab'];
  }

  // Always keep voiceId + azanSoundId aligned to a known catalog id.
  const soundId = resolveAzanSoundId(
    (merged.azanSoundId as string) || (merged.voiceId as string),
  );
  merged.voiceId = soundId;
  merged.azanSoundId = soundId;
  merged.notificationSoundId = resolveNotificationSoundId(
    merged.notificationSoundId as string,
  );

  return azanPreferencesSchema.parse(merged);
}

function enrichPrefs(prefs: AzanPreferences): AzanPreferencesResponse {
  const azanSound = getAzanSoundById(prefs.azanSoundId ?? prefs.voiceId);
  const notificationSound = getNotificationSoundById(prefs.notificationSoundId);
  return {
    ...prefs,
    voiceId: azanSound.id,
    azanSoundId: azanSound.id,
    notificationSoundId: notificationSound.id,
    azanSound,
    notificationSound,
  };
}

export async function getAzanPreferences(userId: string): Promise<AzanPreferencesResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      azanPreferences: true,
      prayerCalculationMethod: true,
      latitude: true,
      longitude: true,
      city: true,
    },
  });
  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  const prefs = normalizePrefs(user.azanPreferences);
  if (prefs.lastLat == null && user.latitude != null) prefs.lastLat = user.latitude;
  if (prefs.lastLng == null && user.longitude != null) prefs.lastLng = user.longitude;
  if (!prefs.lastLocationLabel && user.city) prefs.lastLocationLabel = user.city;
  if (prefs.calculationMethod === 'EGYPT' && user.prayerCalculationMethod) {
    if (user.azanPreferences == null) {
      const method = String(user.prayerCalculationMethod).toUpperCase();
      if (method.includes('EGYPT')) prefs.calculationMethod = 'EGYPT';
      else if (method.includes('MWL') || method.includes('MUSLIM_WORLD'))
        prefs.calculationMethod = 'MWL';
      else if (method.includes('MAKKAH') || method.includes('UMM'))
        prefs.calculationMethod = 'MAKKAH';
      else if (method.includes('KARACHI')) prefs.calculationMethod = 'KARACHI';
      else if (method.includes('ISNA')) prefs.calculationMethod = 'ISNA';
      else if (method.includes('TEHRAN')) prefs.calculationMethod = 'TEHRAN';
    }
  }

  const hasLocation =
    prefs.lastLat != null &&
    prefs.lastLng != null &&
    Number.isFinite(prefs.lastLat) &&
    Number.isFinite(prefs.lastLng);
  if (!hasLocation) {
    prefs.lastLat = DEFAULT_PRAYER_LOCATION.latitude;
    prefs.lastLng = DEFAULT_PRAYER_LOCATION.longitude;
    prefs.lastLocationLabel = prefs.lastLocationLabel || DEFAULT_PRAYER_LOCATION.city;
    prefs.isDefaultLocation = true;
    prefs.locationSource = 'default_cairo';
  } else {
    const isCairoDefault =
      Math.abs(prefs.lastLat! - DEFAULT_PRAYER_LOCATION.latitude) < 0.0001 &&
      Math.abs(prefs.lastLng! - DEFAULT_PRAYER_LOCATION.longitude) < 0.0001 &&
      user.latitude == null &&
      user.longitude == null;
    prefs.isDefaultLocation = isCairoDefault;
    prefs.locationSource = isCairoDefault ? 'default_cairo' : 'profile';
  }
  return enrichPrefs(prefs);
}

export async function updateAzanPreferences(
  userId: string,
  patch: Partial<AzanPreferences> & { azanSoundId?: string },
): Promise<AzanPreferencesResponse> {
  const current = await getAzanPreferences(userId);

  // If the client sends only voiceId (legacy), do not let the previous
  // azanSoundId from `current` win inside normalizePrefs.
  const mergedInput: Record<string, unknown> = { ...current, ...patch };
  if (
    typeof patch.voiceId === 'string' &&
    patch.voiceId.trim() &&
    (patch.azanSoundId == null || !String(patch.azanSoundId).trim())
  ) {
    mergedInput.azanSoundId = patch.voiceId;
  }
  if (
    typeof patch.azanSoundId === 'string' &&
    patch.azanSoundId.trim() &&
    (patch.voiceId == null || !String(patch.voiceId).trim())
  ) {
    mergedInput.voiceId = patch.azanSoundId;
  }

  const next = normalizePrefs(mergedInput);

  const {
    isDefaultLocation: _i,
    locationSource: _s,
    azanSound: _a,
    notificationSound: _n,
    ...persistable
  } = next as AzanPreferences & {
    azanSound?: unknown;
    notificationSound?: unknown;
  };

  const explicitLocation =
    patch.lastLat != null &&
    patch.lastLng != null &&
    Number.isFinite(patch.lastLat) &&
    Number.isFinite(patch.lastLng);

  await prisma.user.update({
    where: { id: userId },
    data: {
      azanPreferences: persistable as any,
      prayerCalculationMethod: next.calculationMethod,
      ...(explicitLocation
        ? { latitude: patch.lastLat, longitude: patch.lastLng }
        : {}),
      ...(patch.lastLocationLabel != null
        ? { city: patch.lastLocationLabel || null }
        : {}),
    },
  });

  return getAzanPreferences(userId);
}

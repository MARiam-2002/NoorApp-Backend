import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';

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
  voiceId: z.string().trim().min(1).max(64).default('makkah'),
  calculationMethod: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .default('EGYPT'),
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
});

export type AzanPreferences = z.infer<typeof azanPreferencesSchema>;

export function defaultAzanPreferences(): AzanPreferences {
  return azanPreferencesSchema.parse({});
}

function normalizePrefs(raw: unknown): AzanPreferences {
  const base = defaultAzanPreferences();
  if (!raw || typeof raw !== 'object') return base;
  const merged = { ...base, ...(raw as Record<string, unknown>) };
  if (
    merged.madhab &&
    typeof merged.madhab === 'string'
  ) {
    merged.madhab = merged.madhab.toUpperCase() as AzanPreferences['madhab'];
  }
  return azanPreferencesSchema.parse(merged);
}

export async function getAzanPreferences(userId: string): Promise<AzanPreferences> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { azanPreferences: true, prayerCalculationMethod: true, latitude: true, longitude: true, city: true },
  });
  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  const prefs = normalizePrefs(user.azanPreferences);
  // Fill location defaults from profile when not set on prefs
  if (prefs.lastLat == null && user.latitude != null) prefs.lastLat = user.latitude;
  if (prefs.lastLng == null && user.longitude != null) prefs.lastLng = user.longitude;
  if (!prefs.lastLocationLabel && user.city) prefs.lastLocationLabel = user.city;
  if (prefs.calculationMethod === 'EGYPT' && user.prayerCalculationMethod) {
    // Keep prefs.calculationMethod as the sync source of truth once stored;
    // only hint Egyptian default from profile when prefs were never saved.
    if (user.azanPreferences == null) {
      const method = String(user.prayerCalculationMethod).toUpperCase();
      if (method.includes('EGYPT')) prefs.calculationMethod = 'EGYPT';
      else if (method.includes('MWL') || method.includes('MUSLIM_WORLD')) prefs.calculationMethod = 'MWL';
      else if (method.includes('MAKKAH') || method.includes('UMM')) prefs.calculationMethod = 'MAKKAH';
      else if (method.includes('KARACHI')) prefs.calculationMethod = 'KARACHI';
      else if (method.includes('ISNA')) prefs.calculationMethod = 'ISNA';
      else if (method.includes('TEHRAN')) prefs.calculationMethod = 'TEHRAN';
    }
  }
  return prefs;
}

export async function updateAzanPreferences(
  userId: string,
  patch: Partial<AzanPreferences>,
): Promise<AzanPreferences> {
  const current = await getAzanPreferences(userId);
  const next = normalizePrefs({ ...current, ...patch });

  await prisma.user.update({
    where: { id: userId },
    data: {
      azanPreferences: next as any,
      // Keep prayer method aligned for dashboard schedule
      prayerCalculationMethod: next.calculationMethod,
      ...(next.lastLat != null && next.lastLng != null
        ? { latitude: next.lastLat, longitude: next.lastLng }
        : {}),
      ...(next.lastLocationLabel
        ? { city: next.lastLocationLabel }
        : {}),
    },
  });

  return next;
}

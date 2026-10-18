import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { AZAN_PREFERENCES_USER_SELECT, buildAzanPreferencesFromUser } from './azan.service';
import { computePrayerInstantsAround, resolvePrayerTimezone } from './prayer.service';
import { getZonedYmd } from '../shared/utils/prayer-location';

export const fajrAlarmPreferencesSchema = z.object({
  enabled: z.boolean().default(false),
  beforeFajrMinutes: z.number().int().min(0).max(60).default(0),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7)
    .refine(v => new Set(v).size === v.length, 'Weekdays must be unique')
    .transform(v => [...v].sort()).default([1, 2, 3, 4, 5, 6, 7]),
  dismissalMode: z.enum(['math', 'button']).default('math'),
  difficulty: z.enum(['easy', 'medium']).default('easy'),
  questionCount: z.number().int().min(1).max(5).default(2),
  snoozeEnabled: z.boolean().default(true),
  snoozeMinutes: z.number().int().min(1).max(15).default(5),
  maxSnoozes: z.number().int().min(0).max(3).default(1),
  maxRingMinutes: z.number().int().min(1).max(15).default(10),
  gradualVolumeEnabled: z.boolean().default(true),
  vibrationEnabled: z.boolean().default(true),
  soundId: z.enum(['system_alarm', 'fajr_wakeup_voice_v1']).default('system_alarm'),
}).strict();
export type FajrAlarmPreferences = z.infer<typeof fajrAlarmPreferencesSchema>;
// Zod 4 applies nested defaults even inside optional fields. Remove defaults before
// making PATCH optional, otherwise a one-field edit resets the other settings.
export const fajrAlarmPatchPreferencesSchema = z.object(Object.fromEntries(
  Object.entries(fajrAlarmPreferencesSchema.shape).map(([key, field]) => [key, field.removeDefault().optional()]),
)).strict().refine(v => Object.keys(v).length > 0, 'Empty patch');
export const fajrAlarmPatchSchema = z.object({
  expectedRevision: z.number().int().nonnegative().max(2147483646),
  preferences: fajrAlarmPatchPreferencesSchema,
}).strict();
export const fajrAlarmScheduleQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(14).default(7) }).strict();
type PreferenceRow = { preferences: unknown; revision: number; updatedAt: Date };
export const FAJR_ALARM_POLICY = {
  deliveryMode: 'DEVICE_LOCAL', cloudEnabledDoesNotArmDevice: true,
  emergencyStopHoldSeconds: 5, iosMathDismissalEnforceable: false,
  awardsPrayerCompletion: false, schemaVersion: 1,
} as const;
const defaults = () => fajrAlarmPreferencesSchema.parse({});
function view(row?: PreferenceRow) {
  return { preferences: row ? fajrAlarmPreferencesSchema.parse(row.preferences) : defaults(),
    revision: row?.revision ?? 0, updatedAt: row?.updatedAt.toISOString() ?? null, policy: FAJR_ALARM_POLICY };
}
async function readPreference(db: Pick<typeof prisma, '$queryRaw'>, userId: string) {
  const rows = await db.$queryRaw<PreferenceRow[]>`SELECT "preferences", "revision", "updatedAt" FROM fajr_alarm_preferences WHERE "userId" = ${userId}`;
  return rows[0];
}
export async function getFajrAlarmPreferences(userId: string) { return view(await readPreference(prisma, userId)); }
export async function updateFajrAlarmPreferences(userId: string, body: unknown) {
  const patch = fajrAlarmPatchSchema.parse(body);
  return prisma.$transaction(async tx => {
    // Serialize first inserts as well as later updates; never accept a user ID from the body.
    const owners = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    if (!owners.length) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    const current = await readPreference(tx, userId);
    if ((current?.revision ?? 0) !== patch.expectedRevision) {
      throw new AppError('Fajr alarm settings changed. Fetch settings and reconcile before retrying.', 409, ErrorCodes.CONFLICT);
    }
    const preferences = fajrAlarmPreferencesSchema.parse({ ...view(current).preferences, ...patch.preferences });
    const rows = await tx.$queryRaw<PreferenceRow[]>`
      INSERT INTO fajr_alarm_preferences ("userId", preferences, revision, "updatedAt")
      VALUES (${userId}, ${JSON.stringify(preferences)}::jsonb, 1, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId") DO UPDATE SET preferences = EXCLUDED.preferences,
        revision = fajr_alarm_preferences.revision + 1, "updatedAt" = CURRENT_TIMESTAMP
      RETURNING preferences, revision, "updatedAt"`;
    return view(rows[0]);
  });
}

// Pure resolver shared by endpoint and tests. Reuse the canonical high-latitude
// estimate when available; skip non-finite results instead of inventing midnight.
export function buildFajrAlarmSchedule(user: any, settings: ReturnType<typeof view>, days = 7, now = new Date()) {
  days = fajrAlarmScheduleQuerySchema.parse({ days }).days;
  const p = settings.preferences;
  const base = { ...settings, serverTime: now.toISOString(), calculationIsEstimate: true,
    refreshAfterUtc: new Date(now.getTime() + 6 * 3600000).toISOString() };
  if (!p.enabled) return { ...base, status: 'DISABLED', timezone: user.timezone, scheduleKey: null, occurrences: [], unavailableDates: [] };
  if (user.latitude == null || user.longitude == null || !Number.isFinite(user.latitude) || !Number.isFinite(user.longitude)
    || Math.abs(user.latitude) > 90 || Math.abs(user.longitude) > 180) {
    return { ...base, status: 'LOCATION_REQUIRED', timezone: user.timezone, scheduleKey: null, occurrences: [], unavailableDates: [] };
  }
  const azan = buildAzanPreferencesFromUser(user);
  const input = { latitude: user.latitude, longitude: user.longitude, timezone: user.timezone,
    method: azan.calculationMethod, madhab: azan.madhab, locationSource: 'profile' as const };
  const timezone = resolvePrayerTimezone(input.latitude, input.longitude, input.timezone, input.locationSource);
  const today = getZonedYmd(now, timezone);
  const scheduleKey = createHash('sha256').update(JSON.stringify([
    input.latitude, input.longitude, timezone, input.method, input.madhab, settings.revision, p,
  ])).digest('hex');
  const occurrences: { occurrenceKey: string; fajrLocalDate: string; alarmLocalDate: string; fajrAtUtc: string; alarmAtUtc: string }[] = [];
  const unavailableDates: string[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + i, 12));
    const date = day.toISOString().slice(0, 10);
    const weekday = day.getUTCDay() || 7;
    if (!p.weekdays.includes(weekday)) continue;
    const fajr = computePrayerInstantsAround({ ...input, now: day }).instants.find(v => v.date === date && v.key === 'FAJR');
    if (!fajr) { unavailableDates.push(date); continue; }
    const alarmAt = new Date(fajr.timestamp.getTime() - p.beforeFajrMinutes * 60000);
    if (alarmAt.getTime() <= now.getTime()) continue;
    occurrences.push({ occurrenceKey: `FAJR_WAKE|${date}`, fajrLocalDate: date,
      alarmLocalDate: getZonedYmd(alarmAt, timezone).dateStr,
      fajrAtUtc: fajr.timestamp.toISOString(), alarmAtUtc: alarmAt.toISOString() });
  }
  return { ...base, status: unavailableDates.length ? 'PARTIAL' : 'READY', timezone,
    calculationMethod: input.method, madhab: input.madhab, scheduleKey,
    windowStartFajrLocalDate: today.dateStr,
    windowEndFajrLocalDate: new Date(Date.UTC(today.year, today.month - 1, today.day + days - 1, 12)).toISOString().slice(0, 10),
    occurrences, unavailableDates };
}
export async function getFajrAlarmSchedule(userId: string, days: number) {
  // A single DB snapshot prevents mixing a location change with an older preference read.
  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { ...AZAN_PREFERENCES_USER_SELECT, timezone: true } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    return buildFajrAlarmSchedule(user, view(await readPreference(tx, userId)), days);
  }, { isolationLevel: 'RepeatableRead' });
}

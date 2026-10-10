import type { NawafelKey } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { getUserLocalCalendarDay } from '../shared/utils/user-local-date';
import {
  NAWAFEL_KEYS,
  NAWAFEL_CATALOG,
  NAWAFEL_SLOT_COUNT,
  NAWAFEL_TOTAL_RAKAHS,
  getNawafelByKey,
  isNawafelKey,
  type NawafelKeyId,
} from '../shared/constants/nawafel';
import { dateSchema } from '../shared/utils/zakat';

export const nawafelPreferencesPatchSchema = z.object({
  showOnHome: z.boolean().optional(),
  selectedKeys: z.array(z.enum(NAWAFEL_KEYS)).max(5).refine(keys => new Set(keys).size === keys.length, 'Duplicate slots are not allowed').optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one preference is required');
export const nawafelCompletionSchema = z.object({ completed: z.boolean(), date: dateSchema }).strict();
const preferenceSchema = z.object({ showOnHome: z.boolean().default(true), selectedKeys: z.array(z.enum(NAWAFEL_KEYS)).default([...NAWAFEL_KEYS]) });
export async function getNawafelPreferences(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { nawafelPreferences: true } });
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  return preferenceSchema.parse(user.nawafelPreferences ?? {});
}
export async function updateNawafelPreferences(userId: string, raw: z.infer<typeof nawafelPreferencesPatchSchema>) {
  const patch = nawafelPreferencesPatchSchema.parse(raw);
  // Merge atomically: changes to visibility and selection on different devices do not overwrite each other.
  const count = await prisma.$executeRaw`UPDATE "users" SET "nawafelPreferences" = COALESCE("nawafelPreferences", '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${userId}`;
  if (!count) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  return getNawafelPreferences(userId);
}

export type NawafelItemDto = {
  selected: boolean;
  key: NawafelKeyId;
  rakahs: number;
  sortOrder: number;
  linkedPrayer: string;
  position: string;
  titleAr: string;
  titleEn: string;
  captionAr: string;
  captionEn: string;
  completed: boolean;
};

export type NawafelTodayDto = {
  preferences: { showOnHome: boolean; selectedKeys: NawafelKeyId[] };
  tracking: { state: 'ACTIVE' | 'NONE_SELECTED'; completedSlots: number; totalSlots: number; completedRakahs: number; totalRakahs: number; progress: number };
  date: string;
  timezone: string;
  items: NawafelItemDto[];
  completedSlots: number;
  totalSlots: number;
  completedRakahs: number;
  totalRakahs: number;
  progress: number;
  labelAr: string;
  labelEn: string;
  captionAr: string;
  captionEn: string;
};

async function resolveUserDay(userId: string): Promise<{ dayKey: string; date: Date; timezone: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }
  return getUserLocalCalendarDay(userId);
}

function buildTodayDto(
  dayKey: string,
  timezone: string,
  completedKeys: Set<string>,
  preferences: { showOnHome: boolean; selectedKeys: NawafelKeyId[] },
): NawafelTodayDto {
  const items: NawafelItemDto[] = NAWAFEL_CATALOG.map((item) => ({
    selected: preferences.selectedKeys.includes(item.key),
    key: item.key,
    rakahs: item.rakahs,
    sortOrder: item.sortOrder,
    linkedPrayer: item.linkedPrayer,
    position: item.position,
    titleAr: item.titleAr,
    titleEn: item.titleEn,
    captionAr: item.captionAr,
    captionEn: item.captionEn,
    completed: completedKeys.has(item.key),
  }));

  const completedSlots = items.filter((i) => i.completed).length;
  const completedRakahs = items
    .filter((i) => i.completed)
    .reduce((sum, i) => sum + i.rakahs, 0);
  const progress =
    NAWAFEL_TOTAL_RAKAHS > 0
      ? Math.round((completedRakahs / NAWAFEL_TOTAL_RAKAHS) * 100) / 100
      : 0;
  const selected = items.filter(item => preferences.selectedKeys.includes(item.key));
  const selectedRakahs = selected.reduce((sum, item) => sum + item.rakahs, 0);
  const selectedCompleted = selected.filter(item => item.completed);
  const selectedCompletedRakahs = selectedCompleted.reduce((sum, item) => sum + item.rakahs, 0);

  return {
    preferences,
    tracking: { state: selected.length ? 'ACTIVE' : 'NONE_SELECTED', completedSlots: selectedCompleted.length,
      totalSlots: selected.length, completedRakahs: selectedCompletedRakahs, totalRakahs: selectedRakahs,
      progress: selectedRakahs ? Math.round(selectedCompletedRakahs / selectedRakahs * 100) / 100 : 0 },
    date: dayKey,
    timezone,
    items,
    completedSlots,
    totalSlots: NAWAFEL_SLOT_COUNT,
    completedRakahs,
    totalRakahs: NAWAFEL_TOTAL_RAKAHS,
    progress,
    labelAr: 'الرواتب',
    labelEn: 'Rawatib',
    captionAr: `${completedRakahs} من ${NAWAFEL_TOTAL_RAKAHS} ركعة اليوم`,
    captionEn: `${completedRakahs} of ${NAWAFEL_TOTAL_RAKAHS} rak‘ahs today`,
  };
}

export async function getNawafelToday(userId: string): Promise<NawafelTodayDto> {
  const { dayKey, date, timezone } = await resolveUserDay(userId);
  const rows = await prisma.nawafelCompletion.findMany({
    where: { userId, date },
    select: { key: true },
  });
  const completedKeys = new Set(rows.map((r) => r.key));
  return buildTodayDto(dayKey, timezone, completedKeys, await getNawafelPreferences(userId));
}

export async function setNawafelCompletion(userId: string, keyRaw: string, raw: z.infer<typeof nawafelCompletionSchema>) {
  if (!isNawafelKey(keyRaw)) throw new AppError('Invalid nawafel key', 400, ErrorCodes.VALIDATION_ERROR);
  const input = nawafelCompletionSchema.parse(raw);
  const { dayKey, date } = await resolveUserDay(userId);
  if (input.date !== dayKey) throw new AppError('Local day changed. Refresh today before confirming completion.', 409, ErrorCodes.CONFLICT);
  const preferences = await getNawafelPreferences(userId);
  if (!preferences.selectedKeys.includes(keyRaw)) throw new AppError('Select this sunnah in preferences before recording it.', 400, ErrorCodes.VALIDATION_ERROR);
  if (input.completed) {
    try {
      await prisma.nawafelCompletion.upsert({ where: { userId_date_key: { userId, date, key: keyRaw as NawafelKey } },
        create: { userId, date, key: keyRaw as NawafelKey }, update: {} });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      // A concurrent identical upsert won the unique key. The requested state already exists.
    }
  } else await prisma.nawafelCompletion.deleteMany({ where: { userId, date, key: keyRaw as NawafelKey } });
  return { key: keyRaw, completed: input.completed, today: await getNawafelToday(userId) };
}

/**
 * Toggle slot for the user's local calendar day.
 * Returns the new completed state + full today snapshot.
 */
export async function markNawafel(
  userId: string,
  keyRaw: string,
): Promise<{ key: NawafelKeyId; completed: boolean; today: NawafelTodayDto }> {
  if (!isNawafelKey(keyRaw)) {
    throw new AppError('Invalid nawafel key', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  const catalog = getNawafelByKey(keyRaw);
  if (!catalog) {
    throw new AppError('Invalid nawafel key', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }

  const { dayKey, date, timezone } = await resolveUserDay(userId);
  const existing = await prisma.nawafelCompletion.findUnique({
    where: {
      userId_date_key: { userId, date, key: keyRaw as NawafelKey },
    },
  });

  let completed: boolean;
  if (existing) {
    await prisma.nawafelCompletion.delete({ where: { id: existing.id } });
    completed = false;
  } else {
    await prisma.nawafelCompletion.create({
      data: { userId, date, key: keyRaw as NawafelKey },
    });
    completed = true;
  }

  const rows = await prisma.nawafelCompletion.findMany({
    where: { userId, date },
    select: { key: true },
  });
  const today = buildTodayDto(dayKey, timezone, new Set(rows.map((r) => r.key)), await getNawafelPreferences(userId));

  return { key: keyRaw, completed, today };
}

/** Lightweight tile for Dashboard dailyJourney (additive). */
export async function getNawafelDashboardTile(userId: string): Promise<{
  visible: boolean;
  trackingState: 'ACTIVE' | 'NONE_SELECTED';
  completed: number;
  total: number;
  progress: number;
  completedSlots: number;
  totalSlots: number;
  labelAr: string;
  labelEn: string;
  captionAr: string;
  captionEn: string;
}> {
  const today = await getNawafelToday(userId);
  return {
    visible: today.preferences.showOnHome,
    trackingState: today.tracking.state,
    completed: today.tracking.completedRakahs,
    total: today.tracking.totalRakahs,
    progress: today.tracking.progress,
    completedSlots: today.tracking.completedSlots,
    totalSlots: today.tracking.totalSlots,
    labelAr: today.labelAr,
    labelEn: today.labelEn,
    captionAr: today.tracking.state === 'NONE_SELECTED' ? 'اختر السنن التي ترغب في متابعتها' : `${today.tracking.completedRakahs} من ${today.tracking.totalRakahs} ركعة اليوم`,
    captionEn: today.tracking.state === 'NONE_SELECTED' ? 'Choose the sunnah slots you want to track' : `${today.tracking.completedRakahs} of ${today.tracking.totalRakahs} rak‘ahs today`,
  };
}

import type { NawafelKey } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import {
  getLocalClock,
  resolveTimezone,
} from './salawat-reminder.service';
import {
  NAWAFEL_CATALOG,
  NAWAFEL_SLOT_COUNT,
  NAWAFEL_TOTAL_RAKAHS,
  getNawafelByKey,
  isNawafelKey,
  type NawafelKeyId,
} from '../shared/constants/nawafel';

export type NawafelItemDto = {
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

function dateOnlyFromDayKey(dayKey: string): Date {
  const parts = dayKey.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, d));
}

async function resolveUserDay(userId: string): Promise<{ dayKey: string; date: Date; timezone: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }
  const timezone = resolveTimezone(user.timezone);
  const dayKey = getLocalClock(new Date(), timezone).dayKey;
  return { dayKey, date: dateOnlyFromDayKey(dayKey), timezone };
}

function buildTodayDto(
  dayKey: string,
  timezone: string,
  completedKeys: Set<string>,
): NawafelTodayDto {
  const items: NawafelItemDto[] = NAWAFEL_CATALOG.map((item) => ({
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

  return {
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
  return buildTodayDto(dayKey, timezone, completedKeys);
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
  const today = buildTodayDto(dayKey, timezone, new Set(rows.map((r) => r.key)));

  return { key: keyRaw, completed, today };
}

/** Lightweight tile for Dashboard dailyJourney (additive). */
export async function getNawafelDashboardTile(userId: string): Promise<{
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
    completed: today.completedRakahs,
    total: today.totalRakahs,
    progress: today.progress,
    completedSlots: today.completedSlots,
    totalSlots: today.totalSlots,
    labelAr: today.labelAr,
    labelEn: today.labelEn,
    captionAr: today.captionAr,
    captionEn: today.captionEn,
  };
}

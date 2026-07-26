import type { PrayerName } from '@prisma/client';
import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { DefaultTimezone, PrayerNameEnum, PrayerOrder } from '../utils/constants';
import { getDayOfYear, getTodayDateOnly } from '../utils/date';

const DEFAULT_LATITUDE = 30.0444;
const DEFAULT_LONGITUDE = 31.2357;

const prayerLabelsAr: Record<PrayerNameEnum, string> = {
  [PrayerNameEnum.FAJR]: 'الفجر',
  [PrayerNameEnum.DHUHR]: 'الظهر',
  [PrayerNameEnum.ASR]: 'العصر',
  [PrayerNameEnum.MAGHRIB]: 'المغرب',
  [PrayerNameEnum.ISHA]: 'العشاء',
};

export type PrayerScheduleItem = {
  name: PrayerNameEnum;
  nameAr: string;
  time: string;
  timestamp: Date;
  completed: boolean;
};

export type NextPrayerInfo = {
  name: PrayerNameEnum;
  nameAr: string;
  time: string;
  timestamp: Date;
  countdownSeconds: number;
};

export type DailyPrayerSchedule = {
  date: string;
  timezone: string;
  nextPrayer: NextPrayerInfo | null;
  schedule: PrayerScheduleItem[];
  completedCount: number;
  totalCount: number;
};

function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

function getPrayerDateMap(prayerTimes: PrayerTimes): Record<PrayerNameEnum, Date> {
  return {
    [PrayerNameEnum.FAJR]: prayerTimes.fajr,
    [PrayerNameEnum.DHUHR]: prayerTimes.dhuhr,
    [PrayerNameEnum.ASR]: prayerTimes.asr,
    [PrayerNameEnum.MAGHRIB]: prayerTimes.maghrib,
    [PrayerNameEnum.ISHA]: prayerTimes.isha,
  };
}

export function calculateDailyPrayerSchedule(
  latitude: number,
  longitude: number,
  timezone = DefaultTimezone,
  completedPrayers: PrayerNameEnum[] = [],
  referenceDate = new Date(),
): DailyPrayerSchedule {
  const coordinates = new Coordinates(latitude, longitude);
  const params = CalculationMethod.Egyptian();
  const prayerTimes = new PrayerTimes(coordinates, referenceDate, params);
  const prayerDateMap = getPrayerDateMap(prayerTimes);
  const now = referenceDate.getTime();

  const schedule: PrayerScheduleItem[] = PrayerOrder.map((name) => {
    const timestamp = prayerDateMap[name];
    return {
      name,
      nameAr: prayerLabelsAr[name],
      time: formatTime(timestamp, timezone),
      timestamp,
      completed: completedPrayers.includes(name),
    };
  });

  const nextPrayerEntry =
    schedule.find((item) => item.timestamp.getTime() > now) ?? schedule[0] ?? null;

  const nextPrayer: NextPrayerInfo | null = nextPrayerEntry
    ? {
        name: nextPrayerEntry.name,
        nameAr:
          nextPrayerEntry.name === PrayerNameEnum.ASR
            ? 'صلاة العصر'
            : `صلاة ${nextPrayerEntry.nameAr}`,
        time: nextPrayerEntry.time,
        timestamp: nextPrayerEntry.timestamp,
        countdownSeconds: Math.max(
          0,
          Math.floor((nextPrayerEntry.timestamp.getTime() - now) / 1000),
        ),
      }
    : null;

  return {
    date: referenceDate.toISOString().slice(0, 10),
    timezone,
    nextPrayer,
    schedule,
    completedCount: completedPrayers.length,
    totalCount: PrayerOrder.length,
  };
}

async function findCompletedPrayers(userId: string, date = getTodayDateOnly()): Promise<PrayerName[]> {
  const records = await prisma.prayerCompletion.findMany({
    where: { userId, date },
    select: { prayer: true },
  });
  return records.map((record) => record.prayer);
}

async function togglePrayer(
  userId: string,
  prayer: PrayerName,
  date = getTodayDateOnly(),
): Promise<boolean> {
  const existing = await prisma.prayerCompletion.findUnique({
    where: {
      userId_date_prayer: { userId, date, prayer },
    },
  });

  if (existing) {
    await prisma.prayerCompletion.delete({
      where: { id: existing.id },
    });
    return false;
  }

  await prisma.prayerCompletion.create({
    data: { userId, date, prayer },
  });
  return true;
}

export async function getTodayPrayers(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { latitude: true, longitude: true, timezone: true },
  });

  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  const completed = await findCompletedPrayers(userId);

  return calculateDailyPrayerSchedule(
    user.latitude ?? DEFAULT_LATITUDE,
    user.longitude ?? DEFAULT_LONGITUDE,
    user.timezone ?? DefaultTimezone,
    completed as PrayerNameEnum[],
  );
}

export async function markPrayer(userId: string, prayerId: string) {
  if (!Object.values(PrayerNameEnum).includes(prayerId as PrayerNameEnum)) {
    throw new AppError('Invalid prayer name', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }

  const completed = await togglePrayer(userId, prayerId as PrayerName);
  return { prayer: prayerId, completed };
}

export async function getPrayerSchedule(
  latitude?: number,
  longitude?: number,
  timezone?: string,
  dateStr?: string,
) {
  const lat = latitude ?? DEFAULT_LATITUDE;
  const lng = longitude ?? DEFAULT_LONGITUDE;
  const tz = timezone ?? DefaultTimezone;
  const refDate = dateStr ? new Date(dateStr) : new Date();

  return calculateDailyPrayerSchedule(lat, lng, tz, [], refDate);
}

import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';

import { DefaultTimezone } from '../constants/timezone';
import { PrayerNameEnum, PrayerOrder } from '../enums/prayer-name.enum';

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

const prayerLabelsAr: Record<PrayerNameEnum, string> = {
  [PrayerNameEnum.FAJR]: 'الفجر',
  [PrayerNameEnum.DHUHR]: 'الظهر',
  [PrayerNameEnum.ASR]: 'العصر',
  [PrayerNameEnum.MAGHRIB]: 'المغرب',
  [PrayerNameEnum.ISHA]: 'العشاء',
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

export function getDayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;

  return Math.floor(diff / oneDay);
}

export function getTodayDateOnly(date = new Date()): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

import type { PrayerName } from '@prisma/client';
import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { DefaultTimezone, PrayerNameEnum, PrayerOrder } from '../utils/constants';
import { getTodayDateOnly } from '../utils/date';
import { parsePrayerKey, prayerEnumToTitle } from '../shared/utils/prayer-names';

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
  /** Flutter contract: Title Case English ("Fajr"). */
  name: string;
  /** Stable enum key for clients that still send FAJR…ISHA. */
  key: PrayerNameEnum;
  nameAr: string;
  time: string;
  displayAr: string;
  displayEn: string;
  iso: string;
  timestamp: Date;
  completed: boolean;
};

export type NextPrayerInfo = {
  name: string;
  key: PrayerNameEnum;
  nameAr: string;
  time: string;
  displayAr: string;
  displayEn: string;
  iso: string;
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

function resolveTimezone(timezone?: string | null): string {
  const candidate = timezone?.trim() || DefaultTimezone;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DefaultTimezone;
  }
}

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toArabicDigits(value: string): string {
  return value.replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)] ?? d);
}

function formatTime(date: Date, timezone: string): string {
  const tz = resolveTimezone(timezone);
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: DefaultTimezone,
    }).format(date);
  }
}

function formatDisplayEn(date: Date, timezone: string): string {
  const tz = resolveTimezone(timezone);
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    }).format(date);
  } catch {
    return formatTime(date, timezone);
  }
}

function formatDisplayAr(date: Date, timezone: string): string {
  const en = formatDisplayEn(date, timezone);
  const meridiem = /PM/i.test(en) ? 'م' : 'ص';
  const clock = en.replace(/\s*(AM|PM)\s*/i, '').trim();
  return `${toArabicDigits(clock)} ${meridiem}`;
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

type PrayerCalcOptions = {
  method?: string;
  madhab?: string;
};

function resolveCalculationParams(options?: PrayerCalcOptions) {
  const methodKey = (options?.method ?? 'EGYPT').toUpperCase();
  const madhabKey = (options?.madhab ?? 'SHAFI').toUpperCase();

  let params;
  switch (methodKey) {
    case 'MWL':
    case 'MUSLIM_WORLD_LEAGUE':
      params = CalculationMethod.MuslimWorldLeague();
      break;
    case 'MAKKAH':
    case 'UMM_AL_QURA':
      params = CalculationMethod.UmmAlQura();
      break;
    case 'KARACHI':
      params = CalculationMethod.Karachi();
      break;
    case 'ISNA':
    case 'NORTH_AMERICA':
      params = CalculationMethod.NorthAmerica();
      break;
    case 'TEHRAN':
      params = CalculationMethod.Tehran();
      break;
    case 'EGYPT':
    case 'EGYPTIAN':
    case 'EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY':
    default:
      params = CalculationMethod.Egyptian();
      break;
  }

  params.madhab = madhabKey === 'HANAFI' ? Madhab.Hanafi : Madhab.Shafi;
  return params;
}

export function calculateDailyPrayerSchedule(
  latitude: number,
  longitude: number,
  timezone = DefaultTimezone,
  completedPrayers: PrayerNameEnum[] = [],
  referenceDate = new Date(),
  options?: PrayerCalcOptions,
): DailyPrayerSchedule {
  const tz = resolveTimezone(timezone);
  const lat = Number.isFinite(latitude) ? latitude : DEFAULT_LATITUDE;
  const lng = Number.isFinite(longitude) ? longitude : DEFAULT_LONGITUDE;
  const coordinates = new Coordinates(lat, lng);
  const params = resolveCalculationParams(options);
  const prayerTimes = new PrayerTimes(coordinates, referenceDate, params);
  const prayerDateMap = getPrayerDateMap(prayerTimes);
  const now = referenceDate.getTime();
  const completedSet = new Set(completedPrayers.map((p) => String(p).toUpperCase()));

  const schedule: PrayerScheduleItem[] = PrayerOrder.map((key) => {
    const timestamp = prayerDateMap[key] ?? new Date();
    return {
      name: prayerEnumToTitle(key),
      key,
      nameAr: prayerLabelsAr[key],
      time: formatTime(timestamp, tz),
      displayEn: formatDisplayEn(timestamp, tz),
      displayAr: formatDisplayAr(timestamp, tz),
      iso: timestamp.toISOString(),
      timestamp,
      completed: completedSet.has(key),
    };
  });

  const nextPrayerEntry =
    schedule.find((item) => item.timestamp instanceof Date && item.timestamp.getTime() > now) ??
    schedule[0] ??
    null;

  const nextPrayer: NextPrayerInfo | null = nextPrayerEntry
    ? {
        name: nextPrayerEntry.name,
        key: nextPrayerEntry.key,
        nameAr: nextPrayerEntry.nameAr,
        time: nextPrayerEntry.time,
        displayAr: nextPrayerEntry.displayAr,
        displayEn: nextPrayerEntry.displayEn,
        iso: nextPrayerEntry.iso,
        timestamp: nextPrayerEntry.timestamp,
        countdownSeconds: Math.max(
          0,
          Math.floor((nextPrayerEntry.timestamp.getTime() - now) / 1000),
        ),
      }
    : null;

  return {
    date: referenceDate.toISOString().slice(0, 10),
    timezone: tz,
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
    select: {
      latitude: true,
      longitude: true,
      timezone: true,
      prayerCalculationMethod: true,
    },
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
    new Date(),
    { method: user.prayerCalculationMethod ?? 'EGYPT' },
  );
}

export async function markPrayer(userId: string, prayerId: string) {
  const prayerKey = parsePrayerKey(prayerId);
  if (!prayerKey) {
    throw new AppError('Invalid prayer name', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }

  const completed = await togglePrayer(userId, prayerKey as PrayerName);
  return { prayer: prayerEnumToTitle(prayerKey), key: prayerKey, completed };
}

export async function getPrayerSchedule(
  latitude?: number,
  longitude?: number,
  timezone?: string,
  dateStr?: string,
  method?: string,
  madhab?: string,
) {
  const lat = latitude ?? DEFAULT_LATITUDE;
  const lng = longitude ?? DEFAULT_LONGITUDE;
  const tz = timezone ?? DefaultTimezone;
  const refDate = dateStr ? new Date(dateStr) : new Date();

  return calculateDailyPrayerSchedule(lat, lng, tz, [], refDate, { method, madhab });
}

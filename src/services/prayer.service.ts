import type { PrayerName } from '@prisma/client';
import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  DEFAULT_PRAYER_LOCATION,
  type PrayerLocationSource,
} from '../shared/constants/default-location';
import { DefaultTimezone, PrayerNameEnum, PrayerOrder } from '../utils/constants';
import { getTodayDateOnly } from '../utils/date';
import { parsePrayerKey, prayerEnumToTitle } from '../shared/utils/prayer-names';
import {
  addCalendarDaysUtcNoon,
  getZonedYmd,
  inferTimezoneFromCoordinates,
  zonedCalendarDateForAdhan,
} from '../shared/utils/prayer-location';

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

export type PrayerLocationMeta = {
  latitude: number;
  longitude: number;
  city: string;
  cityAr: string;
  country: string;
  countryAr: string;
  timezone: string;
  calculationMethod: string;
  madhab: string;
  /** How coordinates were chosen for this response. */
  locationSource: PrayerLocationSource;
  /** True when Cairo defaults were used (no real user/query location). */
  isDefaultLocation: boolean;
};

export type SunriseInfo = {
  /** Display-only English label. */
  name: 'Sunrise';
  /** Not a PrayerName enum — never used for mark/completion. */
  key: 'SUNRISE';
  nameAr: 'الشروق';
  time: string;
  displayAr: string;
  displayEn: string;
  iso: string;
  /**
   * Always false — sunrise is display-only (not Azan, not journey completion).
   * Flutter: show the row time; do not call PATCH mark for SUNRISE.
   */
  trackable: false;
};

export type DailyPrayerSchedule = {
  date: string;
  timezone: string;
  nextPrayer: NextPrayerInfo | null;
  schedule: PrayerScheduleItem[];
  /** Additive (2026-09): sunrise time for Prayer screen row — NOT in schedule[]. */
  sunrise: SunriseInfo;
  completedCount: number;
  totalCount: number;
} & PrayerLocationMeta;

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
  locationSource?: PrayerLocationSource;
  city?: string | null;
  cityAr?: string | null;
  country?: string | null;
  countryAr?: string | null;
  /**
   * When true, `timezone` argument is treated as an explicit client/profile value
   * and must not be replaced by geo inference.
   */
  timezoneExplicit?: boolean;
};

function normalizeMethodKey(method?: string | null): string {
  return (method ?? DEFAULT_PRAYER_LOCATION.calculationMethod).toUpperCase();
}

function normalizeMadhabKey(madhab?: string | null): string {
  return (madhab ?? DEFAULT_PRAYER_LOCATION.madhab).toUpperCase() === 'HANAFI'
    ? 'HANAFI'
    : 'SHAFI';
}

function resolveCalculationParams(options?: PrayerCalcOptions) {
  const methodKey = normalizeMethodKey(options?.method);
  const madhabKey = normalizeMadhabKey(options?.madhab);

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
  return { params, methodKey, madhabKey };
}

function buildLocationMeta(
  lat: number,
  lng: number,
  tz: string,
  methodKey: string,
  madhabKey: string,
  options?: PrayerCalcOptions,
): PrayerLocationMeta {
  const locationSource = options?.locationSource ?? 'default_cairo';
  const isDefaultLocation = locationSource === 'default_cairo';
  const cityFallback =
    locationSource === 'profile'
      ? options?.city?.trim() || 'Saved location'
      : locationSource === 'query'
        ? options?.city?.trim() || 'Current location'
        : 'Custom';
  return {
    latitude: lat,
    longitude: lng,
    city: options?.city?.trim() || (isDefaultLocation ? DEFAULT_PRAYER_LOCATION.city : cityFallback),
    cityAr:
      options?.cityAr?.trim() ||
      (isDefaultLocation
        ? DEFAULT_PRAYER_LOCATION.cityAr
        : options?.city?.trim() || (locationSource === 'query' ? 'موقعك الحالي' : 'موقع محفوظ')),
    country:
      options?.country?.trim() ||
      (isDefaultLocation ? DEFAULT_PRAYER_LOCATION.country : options?.country?.trim() || '—'),
    countryAr:
      options?.countryAr?.trim() ||
      (isDefaultLocation ? DEFAULT_PRAYER_LOCATION.countryAr : options?.countryAr?.trim() || '—'),
    timezone: tz,
    calculationMethod: methodKey.includes('EGYPT')
      ? DEFAULT_PRAYER_LOCATION.calculationMethodLabel
      : methodKey,
    madhab: madhabKey,
    locationSource,
    isDefaultLocation,
  };
}

export function calculateDailyPrayerSchedule(
  latitude: number,
  longitude: number,
  timezone = DefaultTimezone,
  completedPrayers: PrayerNameEnum[] = [],
  referenceDate = new Date(),
  options?: PrayerCalcOptions,
): DailyPrayerSchedule {
  const usedDefaultCoords = !Number.isFinite(latitude) || !Number.isFinite(longitude);
  const lat = Number.isFinite(latitude) ? latitude : DEFAULT_LATITUDE;
  const lng = Number.isFinite(longitude) ? longitude : DEFAULT_LONGITUDE;
  const locationSource: PrayerLocationSource =
    options?.locationSource ?? (usedDefaultCoords ? 'default_cairo' : 'query');

  const providedTz = timezone?.trim() || '';
  const looksLikeStaleCairoDefault =
    locationSource !== 'default_cairo' &&
    providedTz === DEFAULT_PRAYER_LOCATION.timezone &&
    (Math.abs(lat - DEFAULT_LATITUDE) > 0.05 || Math.abs(lng - DEFAULT_LONGITUDE) > 0.05);

  // Stale Africa/Cairo on non-Cairo coords wins over "explicit" — User.timezone
  // and many clients default to Cairo even after GPS updates elsewhere.
  const tz = resolveTimezone(
    looksLikeStaleCairoDefault
      ? inferTimezoneFromCoordinates(lat, lng, DEFAULT_PRAYER_LOCATION.timezone)
      : options?.timezoneExplicit && providedTz
        ? providedTz
        : providedTz
          ? providedTz
          : locationSource === 'default_cairo'
            ? DEFAULT_PRAYER_LOCATION.timezone
            : inferTimezoneFromCoordinates(lat, lng, DEFAULT_PRAYER_LOCATION.timezone),
  );

  const nowInstant = referenceDate;
  // Adhan day = local calendar day in the prayer timezone (not server UTC day).
  const adhanDay = zonedCalendarDateForAdhan(nowInstant, tz);
  const coordinates = new Coordinates(lat, lng);
  const { params, methodKey, madhabKey } = resolveCalculationParams(options);
  const prayerTimes = new PrayerTimes(coordinates, adhanDay, params);
  const prayerDateMap = getPrayerDateMap(prayerTimes);
  const now = nowInstant.getTime();
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

  const sunriseTs = prayerTimes.sunrise;
  const sunrise: SunriseInfo = {
    name: 'Sunrise',
    key: 'SUNRISE',
    nameAr: 'الشروق',
    time: formatTime(sunriseTs, tz),
    displayEn: formatDisplayEn(sunriseTs, tz),
    displayAr: formatDisplayAr(sunriseTs, tz),
    iso: sunriseTs.toISOString(),
    trackable: false,
  };

  const upcomingToday = schedule.find(
    (item) => item.timestamp instanceof Date && item.timestamp.getTime() > now,
  );

  let nextPrayer: NextPrayerInfo | null = null;
  if (upcomingToday) {
    nextPrayer = {
      name: upcomingToday.name,
      key: upcomingToday.key,
      nameAr: upcomingToday.nameAr,
      time: upcomingToday.time,
      displayAr: upcomingToday.displayAr,
      displayEn: upcomingToday.displayEn,
      iso: upcomingToday.iso,
      timestamp: upcomingToday.timestamp,
      countdownSeconds: Math.max(
        0,
        Math.floor((upcomingToday.timestamp.getTime() - now) / 1000),
      ),
    };
  } else {
    const tomorrow = addCalendarDaysUtcNoon(adhanDay, 1);
    const tomorrowTimes = new PrayerTimes(coordinates, tomorrow, params);
    const fajrTs = tomorrowTimes.fajr;
    nextPrayer = {
      name: prayerEnumToTitle(PrayerNameEnum.FAJR),
      key: PrayerNameEnum.FAJR,
      nameAr: prayerLabelsAr[PrayerNameEnum.FAJR],
      time: formatTime(fajrTs, tz),
      displayAr: formatDisplayAr(fajrTs, tz),
      displayEn: formatDisplayEn(fajrTs, tz),
      iso: fajrTs.toISOString(),
      timestamp: fajrTs,
      countdownSeconds: Math.max(0, Math.floor((fajrTs.getTime() - now) / 1000)),
    };
  }

  const location = buildLocationMeta(lat, lng, tz, methodKey, madhabKey, {
    ...options,
    locationSource,
  });

  const localDate = getZonedYmd(nowInstant, tz).dateStr;

  return {
    date: localDate,
    nextPrayer,
    schedule,
    sunrise,
    completedCount: completedPrayers.length,
    totalCount: PrayerOrder.length,
    ...location,
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
      city: true,
      country: true,
      prayerCalculationMethod: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  const completed = await findCompletedPrayers(userId);
  const hasProfileLocation =
    user.latitude != null &&
    user.longitude != null &&
    Number.isFinite(user.latitude) &&
    Number.isFinite(user.longitude);

  const lat = hasProfileLocation ? (user.latitude as number) : DEFAULT_LATITUDE;
  const lng = hasProfileLocation ? (user.longitude as number) : DEFAULT_LONGITUDE;
  const profileTz = user.timezone?.trim() || '';
  const coordsNearCairo =
    Math.abs(lat - DEFAULT_LATITUDE) < 0.5 && Math.abs(lng - DEFAULT_LONGITUDE) < 0.5;
  // Prisma default timezone is Africa/Cairo — treat as stale when coords are clearly elsewhere.
  const staleDefaultTimezone =
    hasProfileLocation &&
    profileTz === DEFAULT_PRAYER_LOCATION.timezone &&
    !coordsNearCairo;
  const explicitTimezone = Boolean(profileTz) && !staleDefaultTimezone;

  return calculateDailyPrayerSchedule(
    lat,
    lng,
    explicitTimezone ? profileTz : hasProfileLocation ? '' : DEFAULT_PRAYER_LOCATION.timezone,
    completed as PrayerNameEnum[],
    new Date(),
    {
      method: user.prayerCalculationMethod ?? DEFAULT_PRAYER_LOCATION.calculationMethod,
      locationSource: hasProfileLocation ? 'profile' : 'default_cairo',
      timezoneExplicit: explicitTimezone,
      city: hasProfileLocation ? user.city : DEFAULT_PRAYER_LOCATION.city,
      cityAr: hasProfileLocation
        ? user.city ?? undefined
        : DEFAULT_PRAYER_LOCATION.cityAr,
      country: hasProfileLocation
        ? user.country ?? undefined
        : DEFAULT_PRAYER_LOCATION.country,
      countryAr: hasProfileLocation ? undefined : DEFAULT_PRAYER_LOCATION.countryAr,
    },
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
  locationSource?: PrayerLocationSource,
  city?: string | null,
  cityAr?: string | null,
  country?: string | null,
  countryAr?: string | null,
) {
  const hasCoords =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);
  const lat = hasCoords ? (latitude as number) : DEFAULT_LATITUDE;
  const lng = hasCoords ? (longitude as number) : DEFAULT_LONGITUDE;
  const source: PrayerLocationSource =
    locationSource ?? (hasCoords ? 'query' : 'default_cairo');
  const explicitTimezone = Boolean(timezone?.trim());
  const tz = explicitTimezone
    ? (timezone as string)
    : source === 'default_cairo'
      ? DEFAULT_PRAYER_LOCATION.timezone
      : ''; // infer inside calculateDailyPrayerSchedule
  const refDate = dateStr ? new Date(dateStr) : new Date();

  return calculateDailyPrayerSchedule(lat, lng, tz, [], refDate, {
    method: method ?? DEFAULT_PRAYER_LOCATION.calculationMethod,
    madhab: madhab ?? DEFAULT_PRAYER_LOCATION.madhab,
    locationSource: source,
    timezoneExplicit: explicitTimezone,
    city: source === 'default_cairo' ? DEFAULT_PRAYER_LOCATION.city : city,
    cityAr:
      source === 'default_cairo' ? DEFAULT_PRAYER_LOCATION.cityAr : cityAr ?? city,
    country: source === 'default_cairo' ? DEFAULT_PRAYER_LOCATION.country : country,
    countryAr:
      source === 'default_cairo' ? DEFAULT_PRAYER_LOCATION.countryAr : countryAr,
  });
}

/** Cairo defaults for guests / pre-location clients. */
export function getDefaultCairoPrayerSchedule(dateStr?: string) {
  return getPrayerSchedule(
    DEFAULT_LATITUDE,
    DEFAULT_LONGITUDE,
    DEFAULT_PRAYER_LOCATION.timezone,
    dateStr,
    DEFAULT_PRAYER_LOCATION.calculationMethod,
    DEFAULT_PRAYER_LOCATION.madhab,
    'default_cairo',
    DEFAULT_PRAYER_LOCATION.city,
  );
}

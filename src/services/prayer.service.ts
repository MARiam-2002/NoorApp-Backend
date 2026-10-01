import type { PrayerName } from '@prisma/client';
import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PolarCircleResolution,
  PrayerTimes,
} from 'adhan';
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
import { getUserLocalCalendarDay } from '../shared/utils/user-local-date';
import { parsePrayerKey, prayerEnumToTitle } from '../shared/utils/prayer-names';
import {
  addCalendarDaysUtcNoon,
  getZonedYmd,
  inferTimezoneFromCoordinates,
  zonedCalendarDateForAdhan,
} from '../shared/utils/prayer-location';
import { autoCalculationMethodFor, isAutoCalculationMethod } from '../shared/utils/auto-calculation-method';
import { AZAN_PREFERENCES_USER_SELECT, buildAzanPreferencesFromUser } from './azan.service';

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
  /** "auto" = official method of the location's country (user has not picked one); "user" = the user's pick. */
  calculationMethodSource: 'auto' | 'user';
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

// Constructing Intl.DateTimeFormat is ~100x slower than using one; the per-minute
// reminder pass formats thousands of times, so formatters are cached per zone.
const validTimezones = new Map<string, boolean>();
const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function resolveTimezone(timezone?: string | null): string {
  const candidate = timezone?.trim() || DefaultTimezone;
  let valid = validTimezones.get(candidate);
  if (valid === undefined) {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
      valid = true;
    } catch {
      valid = false;
    }
    validTimezones.set(candidate, valid);
  }
  return valid ? candidate : DefaultTimezone;
}

function cachedFormatter(
  locale: 'en-GB' | 'en-US',
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${timeZone}|${options.hour12 ? '12' : '24'}`;
  let formatter = timeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    timeFormatters.set(key, formatter);
  }
  return formatter;
}

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toArabicDigits(value: string): string {
  return value.replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)] ?? d);
}

function formatTime(date: Date, timezone: string): string {
  const tz = resolveTimezone(timezone);
  return cachedFormatter('en-GB', tz, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatDisplayEn(date: Date, timezone: string): string {
  const tz = resolveTimezone(timezone);
  return cachedFormatter('en-US', tz, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
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
  return (method?.trim() || DEFAULT_PRAYER_LOCATION.calculationMethod).toUpperCase();
}

function normalizeMadhabKey(madhab?: string | null): string {
  return (madhab ?? DEFAULT_PRAYER_LOCATION.madhab).toUpperCase() === 'HANAFI'
    ? 'HANAFI'
    : 'SHAFI';
}

function customAngleMethod(fajrAngle: number, ishaAngle: number) {
  const params = CalculationMethod.Other();
  params.fajrAngle = fajrAngle;
  params.ishaAngle = ishaAngle;
  return params;
}

const ummAlQuraMonthFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  timeZone: 'UTC',
  month: 'numeric',
});

/** `adhanDay` is the UTC-noon Date that represents the user's local calendar day. */
function isRamadan(adhanDay: Date): boolean {
  const month = ummAlQuraMonthFormatter.formatToParts(adhanDay).find((p) => p.type === 'month');
  return month?.value === '9';
}

function resolveCalculationParams(
  options: PrayerCalcOptions | undefined,
  coordinates: Coordinates,
  adhanDay: Date,
) {
  const requestedKey = normalizeMethodKey(options?.method);
  const methodSource: 'auto' | 'user' = isAutoCalculationMethod(requestedKey) ? 'auto' : 'user';
  const methodKey =
    methodSource === 'auto'
      ? autoCalculationMethodFor(coordinates.latitude, coordinates.longitude)
      : requestedKey;
  const madhabKey = normalizeMadhabKey(options?.madhab);

  let params;
  let isUmmAlQura = false;
  switch (methodKey) {
    case 'MWL':
    case 'MUSLIM_WORLD_LEAGUE':
      params = CalculationMethod.MuslimWorldLeague();
      break;
    case 'MAKKAH':
    case 'UMM_AL_QURA':
      params = CalculationMethod.UmmAlQura();
      isUmmAlQura = true;
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
    case 'DUBAI':
    case 'UAE':
      params = CalculationMethod.Dubai();
      break;
    case 'QATAR':
      params = CalculationMethod.Qatar();
      break;
    case 'KUWAIT':
      params = CalculationMethod.Kuwait();
      break;
    case 'SINGAPORE':
    case 'MUIS':
    case 'JAKIM':
    case 'MALAYSIA':
      params = CalculationMethod.Singapore();
      break;
    case 'TURKEY':
    case 'DIYANET':
      params = CalculationMethod.Turkey();
      break;
    case 'MOONSIGHTING':
    case 'MOONSIGHTING_COMMITTEE':
      params = CalculationMethod.MoonsightingCommittee();
      break;
    case 'UOIF':
    case 'FRANCE':
      params = customAngleMethod(12, 12);
      break;
    case 'KEMENAG':
    case 'INDONESIA':
      params = customAngleMethod(20, 18);
      break;
    case 'EGYPT':
    case 'EGYPTIAN':
    case 'EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY':
    default:
      params = CalculationMethod.Egyptian();
      break;
  }

  params.madhab = madhabKey === 'HANAFI' ? Madhab.Hanafi : Madhab.Shafi;
  // Above 48° Fajr/Isha twilight may never end in summer; SeventhOfTheNight is the
  // adhan-recommended rule there (MiddleOfTheNight below 48° = unchanged for MENA).
  params.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
  // Inside the polar circles sunrise/sunset can be missing entirely; use the
  // nearest latitude where they exist instead of returning invalid times.
  params.polarCircleResolution = PolarCircleResolution.AqrabBalad;
  // Umm al-Qura officially extends Isha to 120 min after Maghrib during Ramadan.
  if (isUmmAlQura && isRamadan(adhanDay)) {
    params.ishaInterval = 120;
  }
  return { params, methodKey, madhabKey, methodSource };
}

function buildLocationMeta(
  lat: number,
  lng: number,
  tz: string,
  methodKey: string,
  madhabKey: string,
  methodSource: 'auto' | 'user',
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
    calculationMethodSource: methodSource,
    madhab: madhabKey,
    locationSource,
    isDefaultLocation,
  };
}

/**
 * Stale Africa/Cairo on non-Cairo coords wins over "explicit" — User.timezone
 * and many clients default to Cairo even after GPS updates elsewhere.
 */
export function resolvePrayerTimezone(
  lat: number,
  lng: number,
  timezone: string | null | undefined,
  locationSource: PrayerLocationSource,
): string {
  const providedTz = timezone?.trim() || '';
  const looksLikeStaleCairoDefault =
    locationSource !== 'default_cairo' &&
    providedTz === DEFAULT_PRAYER_LOCATION.timezone &&
    (Math.abs(lat - DEFAULT_LATITUDE) > 0.05 || Math.abs(lng - DEFAULT_LONGITUDE) > 0.05);

  return resolveTimezone(
    looksLikeStaleCairoDefault
      ? inferTimezoneFromCoordinates(lat, lng, DEFAULT_PRAYER_LOCATION.timezone)
      : providedTz
        ? providedTz
        : locationSource === 'default_cairo'
          ? DEFAULT_PRAYER_LOCATION.timezone
          : inferTimezoneFromCoordinates(lat, lng, DEFAULT_PRAYER_LOCATION.timezone),
  );
}

export type PrayerInstant = {
  key: PrayerNameEnum;
  /** Local calendar day (YYYY-MM-DD) this prayer belongs to — Isha may fall after midnight. */
  date: string;
  /** Local HH:mm in `timezone`. */
  time: string;
  timestamp: Date;
};

/**
 * Absolute prayer instants for the user's local yesterday, today and tomorrow.
 * Reminder scheduling must compare instants (not same-day HH:mm) so Isha after
 * midnight (high latitudes in summer) and pre-reminders that cross midnight work.
 */
export function computePrayerInstantsAround(input: {
  latitude: number;
  longitude: number;
  timezone?: string | null;
  method?: string;
  madhab?: string;
  locationSource: PrayerLocationSource;
  now?: Date;
}): { timezone: string; instants: PrayerInstant[] } {
  const now = input.now ?? new Date();
  const tz = resolvePrayerTimezone(input.latitude, input.longitude, input.timezone, input.locationSource);
  const coordinates = new Coordinates(input.latitude, input.longitude);
  const today = zonedCalendarDateForAdhan(now, tz);
  const instants: PrayerInstant[] = [];

  for (const offset of [-1, 0, 1]) {
    const day = addCalendarDaysUtcNoon(today, offset);
    const { params } = resolveCalculationParams(
      { method: input.method, madhab: input.madhab },
      coordinates,
      day,
    );
    const map = getPrayerDateMap(new PrayerTimes(coordinates, day, params));
    const date = day.toISOString().slice(0, 10);
    for (const key of PrayerOrder) {
      const timestamp = map[key];
      if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) continue;
      instants.push({ key, date, time: formatTime(timestamp, tz), timestamp });
    }
  }
  return { timezone: tz, instants };
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

  const tz = resolvePrayerTimezone(lat, lng, timezone, locationSource);

  const nowInstant = referenceDate;
  // Adhan day = local calendar day in the prayer timezone (not server UTC day).
  const adhanDay = zonedCalendarDateForAdhan(nowInstant, tz);
  const coordinates = new Coordinates(lat, lng);
  const { params, methodKey, madhabKey, methodSource } = resolveCalculationParams(options, coordinates, adhanDay);
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
    const tomorrowTimes = new PrayerTimes(
      coordinates,
      tomorrow,
      resolveCalculationParams(options, coordinates, tomorrow).params,
    );
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

  const location = buildLocationMeta(lat, lng, tz, methodKey, madhabKey, methodSource, {
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

async function findCompletedPrayers(userId: string, date?: Date): Promise<PrayerName[]> {
  const resolved = date ?? (await getUserLocalCalendarDay(userId)).date;
  const records = await prisma.prayerCompletion.findMany({
    where: { userId, date: resolved },
    select: { prayer: true },
  });
  return records.map((record) => record.prayer);
}

async function togglePrayer(
  userId: string,
  prayer: PrayerName,
  date?: Date,
): Promise<boolean> {
  const resolved = date ?? (await getUserLocalCalendarDay(userId)).date;
  const existing = await prisma.prayerCompletion.findUnique({
    where: {
      userId_date_prayer: { userId, date: resolved, prayer },
    },
  });

  if (existing) {
    await prisma.prayerCompletion.delete({
      where: { id: existing.id },
    });
    return false;
  }

  await prisma.prayerCompletion.create({
    data: { userId, date: resolved, prayer },
  });
  return true;
}

export async function getTodayPrayers(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...AZAN_PREFERENCES_USER_SELECT,
      timezone: true,
      country: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  // Same method + madhab as the Azan notifications (one source of truth).
  const prefs = buildAzanPreferencesFromUser(user);
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
      method: prefs.calculationMethod,
      madhab: prefs.madhab,
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

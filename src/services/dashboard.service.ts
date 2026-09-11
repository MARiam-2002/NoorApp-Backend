import type { ChallengeType, PrayerName } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { calculateDailyPrayerSchedule } from './prayer.service';
import type { DailyPrayerSchedule } from './prayer.service';
import { formatArabicDateInfo, getDayOfYear, getTodayDateOnly } from '../utils/date';
import { isDailyChallengeCompleted } from '../utils/challenge';
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  DEFAULT_PRAYER_LOCATION,
} from '../shared/constants/default-location';
import { DefaultTimezone, PrayerNameEnum, PrayerOrder } from '../utils/constants';
import { ensureSurahCatalog } from '../lib/quran-catalog';
import { resolveSurahNameAr, resolveSurahNameEn } from '../lib/surah-names';
import { prayerEnumToTitle } from '../shared/utils/prayer-names';
import {
  FALLBACK_VERSE,
  FALLBACK_CHALLENGE,
  getCuratedHadithForDay,
} from '../shared/constants/fallbacks';
import {
  DEFAULT_SADAQAH_GOAL_EGP,
  SADAQAH_CURRENCY,
  SADAQAH_CURRENCY_LABEL_AR,
  SADAQAH_CURRENCY_LABEL_EN,
  sadaqahProgressPercent,
} from '../shared/constants/sadaqah';
import {
  getTodayJourneyWithFallback,
  getVerseOfTheDayLite,
  getHadithOfTheDayLite,
  getDailyChallengeTemplate,
} from './daily-content.service';

const TOTAL_QURAN_PAGES = 604;

export type DashboardData = {
  greeting: {
    displayName: string;
    weekdayName: string;
    hijriDate: string;
    points: number;
    fullName?: string | null;
    username?: string;
    gregorianDate?: string;
  };
  prayers: {
    nextPrayer: {
      name: string;
      nameAr: string;
      time: string;
      displayAr?: string;
      displayEn?: string;
      iso?: string;
      countdownSeconds: number;
      key?: string;
    } | null;
    schedule: Array<{
      name: string;
      nameAr: string;
      time: string;
      displayAr?: string;
      displayEn?: string;
      iso?: string;
      completed: boolean;
      key?: string;
    }>;
    date?: string;
    timezone?: string;
    completedCount?: number;
    totalCount?: number;
    latitude?: number;
    longitude?: number;
    city?: string;
    cityAr?: string;
    country?: string;
    countryAr?: string;
    calculationMethod?: string;
    madhab?: string;
    locationSource?: string;
    isDefaultLocation?: boolean;
    /** Additive: display-only sunrise (not in schedule, not completable). */
    sunrise?: {
      name: string;
      key: string;
      nameAr: string;
      time: string;
      displayAr?: string;
      displayEn?: string;
      iso?: string;
      trackable: false;
    };
  };
  verseOfTheDay: {
    textAr: string;
    referenceAr: string;
    surahNumber?: number;
    ayahNumber?: number;
  };
  hadithOfTheDay: { textAr: string; sourceAr: string };
  dailyJourney: {
    prayer: { completed: number; total: number; progress: number; labelAr: string; labelEn: string; captionAr: string; captionEn: string };
    quran: { pagesRead: number; target: number; labelAr: string; labelEn: string; captionAr: string; captionEn: string };
    adhkar: { completed: boolean; labelAr: string; labelEn: string; captionAr: string; captionEn: string };
    sadaqah: {
      amount: number;
      labelAr: string;
      labelEn: string;
      captionAr: string;
      captionEn: string;
      /** Backward-compatible additive fields (2026-09). */
      goal?: number;
      percent?: number;
      currency?: string;
      currencyLabelAr?: string;
      currencyLabelEn?: string;
    };
  };
  khatmah: {
    surahId: number;
    surahNameAr: string;
    currentPage: number;
    progressPercent: number;
    surahNameEn?: string;
  };
  dailyChallenge: {
    titleAr: string;
    titleEn: string;
    descriptionAr: string;
    descriptionEn: string;
    rewardPoints: number;
    targetValue: number;
    completed: boolean;
    claimed: boolean;
  };
  utilities: Record<string, unknown>;
};

async function findCompletedPrayers(
  userId: string,
  date: Date = getTodayDateOnly(),
): Promise<PrayerName[]> {
  const records = await prisma.prayerCompletion.findMany({
    where: { userId, date },
    select: { prayer: true },
  });

  return records.map((record) => record.prayer);
}

async function getOrCreateKhatmah(userId: string) {
  await ensureSurahCatalog();
  try {
    return await prisma.khatmah.upsert({
      where: { userId },
      create: { userId, currentSurahId: 2, currentPage: 1 },
      update: {},
    });
  } catch {
    try {
      return await prisma.khatmah.findUnique({ where: { userId } });
    } catch {
      return null;
    }
  }
}

async function getSurah(surahId: number) {
  try {
    return await prisma.surah.findUnique({ where: { id: surahId } });
  } catch {
    return null;
  }
}

async function getChallengeCompletion(userId: string, dayOfYear: number) {
  return prisma.challengeCompletion.findUnique({
    where: { userId_dayOfYear: { userId, dayOfYear } },
  });
}

export async function getDashboard(userId: string): Promise<DashboardData> {
  const todayInfo = formatArabicDateInfo();
  const fallbackUser = {
    id: userId,
    username: 'noor',
    fullName: null as string | null,
    points: 0,
    timezone: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
    city: null as string | null,
    prayerCalculationMethod: 'EGYPT' as string | null,
  };

  let user = fallbackUser;
  try {
    const fetched = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        points: true,
        timezone: true,
        latitude: true,
        longitude: true,
        city: true,
        prayerCalculationMethod: true,
      },
    });
    if (fetched) user = { ...fallbackUser, ...fetched };
  } catch (err: any) {
    logger.warn('[Dashboard] prisma.user.findUnique failed, using fallback user', {
      code: err?.code,
      message: err?.message,
    });
  }

  try {
    return await buildDashboardPayload(userId, user);
  } catch (err: any) {
    logger.warn('[Dashboard] buildDashboardPayload failed, returning fallback', {
      code: err?.code,
      message: err?.message,
    });
    return {
      greeting: {
        displayName: user.fullName?.trim() || user.username,
        weekdayName: todayInfo.weekdayName,
        hijriDate: todayInfo.hijri,
        points: user.points,
        fullName: user.fullName ?? null,
        username: user.username,
        gregorianDate: todayInfo.gregorian,
      },
      prayers: {
        nextPrayer: null,
        schedule: PrayerOrder.map((key) => {
          const name = prayerEnumToTitle(key);
          const nameAr =
            key === PrayerNameEnum.FAJR
              ? 'الفجر'
              : key === PrayerNameEnum.DHUHR
                ? 'الظهر'
                : key === PrayerNameEnum.ASR
                  ? 'العصر'
                  : key === PrayerNameEnum.MAGHRIB
                    ? 'المغرب'
                    : 'العشاء';
          return {
            name,
            nameAr,
            time: '00:00',
            displayAr: nameAr,
            displayEn: name,
            iso: new Date().toISOString(),
            completed: false,
            key,
          };
        }),
        date: new Date().toISOString().slice(0, 10),
        timezone: user.timezone ?? DefaultTimezone,
        completedCount: 0,
        totalCount: 5,
      },
      verseOfTheDay: FALLBACK_VERSE,
      hadithOfTheDay: getCuratedHadithForDay(getDayOfYear()),
      dailyJourney: {
        prayer: { completed: 0, total: 5, progress: 0, labelAr: 'الصلوات', labelEn: 'Prayers', captionAr: 'صلاة مكتملة اليوم', captionEn: 'prayers completed today' },
        quran: { pagesRead: 0, target: 5, labelAr: 'القرآن', labelEn: 'Quran', captionAr: 'صفحة مقروءة اليوم', captionEn: 'pages read today' },
        adhkar: { completed: false, labelAr: 'الأذكار', labelEn: 'Adhkar', captionAr: 'اكمل وردك اليومي', captionEn: 'Complete your daily wird' },
        sadaqah: {
          amount: 0,
          labelAr: 'الصدقة',
          labelEn: 'Sadaqah',
          captionAr: 'ج.م مصدقة اليوم',
          captionEn: 'EGP donated today',
          goal: DEFAULT_SADAQAH_GOAL_EGP,
          percent: 0,
          currency: SADAQAH_CURRENCY,
          currencyLabelAr: SADAQAH_CURRENCY_LABEL_AR,
          currencyLabelEn: SADAQAH_CURRENCY_LABEL_EN,
        },
      },
      khatmah: {
        surahId: 2,
        surahNameAr: 'البقرة',
        currentPage: 1,
        progressPercent: 0,
        surahNameEn: 'Al-Baqarah',
      },
      dailyChallenge: {
        titleAr: FALLBACK_CHALLENGE.titleAr,
        titleEn: FALLBACK_CHALLENGE.titleEn ?? 'Daily Challenge',
        descriptionAr: FALLBACK_CHALLENGE.descriptionAr,
        descriptionEn: FALLBACK_CHALLENGE.descriptionEn ?? 'Complete today\'s challenge to earn reward points.',
        rewardPoints: FALLBACK_CHALLENGE.rewardPoints,
        targetValue: FALLBACK_CHALLENGE.targetValue,
        completed: false,
        claimed: false,
      },
      utilities: {
        tasbih: { enabled: true },
        qibla: { enabled: true },
      },
    };
  }
}

async function buildDashboardPayload(
  userId: string,
  user: {
    username: string;
    fullName: string | null;
    points: number;
    timezone: string | null;
    latitude: number | null;
    longitude: number | null;
    city?: string | null;
    prayerCalculationMethod?: string | null;
  },
): Promise<DashboardData> {

  const dayOfYear = getDayOfYear();
  const todayInfo = formatArabicDateInfo();

  const [
    completedPrayers,
    journey,
    khatmah,
    verse,
    hadith,
    challengeTemplate,
    challengeCompletion,
  ] = await Promise.all([
    findCompletedPrayers(userId).catch(() => [] as PrayerName[]),
    getTodayJourneyWithFallback(userId),
    getOrCreateKhatmah(userId),
    getVerseOfTheDayLite(dayOfYear).catch(() => FALLBACK_VERSE),
    getHadithOfTheDayLite(dayOfYear).catch(() => getCuratedHadithForDay(dayOfYear)),
    getDailyChallengeTemplate(dayOfYear).catch(() => null),
    getChallengeCompletion(userId, dayOfYear).catch(() => null),
  ]);

  const surah = khatmah?.currentSurahId
    ? await getSurah(khatmah.currentSurahId)
    : null;

  const hasProfileLocation =
    user.latitude != null &&
    user.longitude != null &&
    Number.isFinite(user.latitude) &&
    Number.isFinite(user.longitude);
  const latitude = hasProfileLocation ? (user.latitude as number) : DEFAULT_LATITUDE;
  const longitude = hasProfileLocation ? (user.longitude as number) : DEFAULT_LONGITUDE;
  const timezone = user.timezone ?? DEFAULT_PRAYER_LOCATION.timezone;

  let prayers: DailyPrayerSchedule;
  try {
    prayers = calculateDailyPrayerSchedule(
      latitude,
      longitude,
      timezone,
      completedPrayers as PrayerNameEnum[],
      new Date(),
      {
        method: user.prayerCalculationMethod ?? DEFAULT_PRAYER_LOCATION.calculationMethod,
        locationSource: hasProfileLocation ? 'profile' : 'default_cairo',
        city: hasProfileLocation ? user.city : DEFAULT_PRAYER_LOCATION.city,
        cityAr: hasProfileLocation
          ? user.city ?? undefined
          : DEFAULT_PRAYER_LOCATION.cityAr,
        country: hasProfileLocation ? undefined : DEFAULT_PRAYER_LOCATION.country,
        countryAr: hasProfileLocation ? undefined : DEFAULT_PRAYER_LOCATION.countryAr,
      },
    );
  } catch {
    const nowIso = new Date().toISOString();
    prayers = {
      date: nowIso.slice(0, 10),
      timezone: DEFAULT_PRAYER_LOCATION.timezone,
      nextPrayer: null,
      schedule: PrayerOrder.map((key) => {
        const name = prayerEnumToTitle(key);
        const nameAr =
          key === PrayerNameEnum.FAJR
            ? 'الفجر'
            : key === PrayerNameEnum.DHUHR
              ? 'الظهر'
              : key === PrayerNameEnum.ASR
                ? 'العصر'
                : key === PrayerNameEnum.MAGHRIB
                  ? 'المغرب'
                  : 'العشاء';
        return {
          name,
          key,
          nameAr,
          time: '00:00',
          displayAr: nameAr,
          displayEn: name,
          iso: nowIso,
          timestamp: new Date(),
          completed: false,
        };
      }),
      sunrise: {
        name: 'Sunrise',
        key: 'SUNRISE',
        nameAr: 'الشروق',
        time: '00:00',
        displayAr: 'الشروق',
        displayEn: 'Sunrise',
        iso: nowIso,
        trackable: false,
      },
      completedCount: 0,
      totalCount: 5,
      latitude: DEFAULT_LATITUDE,
      longitude: DEFAULT_LONGITUDE,
      city: DEFAULT_PRAYER_LOCATION.city,
      cityAr: DEFAULT_PRAYER_LOCATION.cityAr,
      country: DEFAULT_PRAYER_LOCATION.country,
      countryAr: DEFAULT_PRAYER_LOCATION.countryAr,
      calculationMethod: DEFAULT_PRAYER_LOCATION.calculationMethodLabel,
      madhab: DEFAULT_PRAYER_LOCATION.madhab,
      locationSource: 'default_cairo',
      isDefaultLocation: true,
    };
  }

  const prayerProgress =
    prayers.totalCount > 0
      ? Math.round((prayers.completedCount / prayers.totalCount) * 100) / 100
      : 0;

  const challengeCompleted = isDailyChallengeCompleted(
    (challengeTemplate?.type ?? FALLBACK_CHALLENGE.type) as ChallengeType,
    challengeTemplate?.targetValue ?? FALLBACK_CHALLENGE.targetValue,
    {
      quranPagesRead: journey.quranPagesRead,
      adhkarCompleted: journey.adhkarCompleted,
      sadaqahAmount: journey.sadaqahAmount,
    },
    completedPrayers,
  );

  const displayName =
    user.fullName?.trim() || user.username;

  const totalPagesRead = khatmah?.totalPagesRead ?? 0;
  const khatmahPayload = {
    surahId: surah?.id ?? 2,
    surahNameEn: resolveSurahNameEn(surah?.id ?? 2, surah?.nameEn) || 'Al-Baqarah',
    surahNameAr: resolveSurahNameAr(surah?.id ?? 2, surah?.nameAr) || 'البقرة',
    currentPage: khatmah?.currentPage ?? 1,
    progressPercent: Math.min(100, Math.round((totalPagesRead * 100) / TOTAL_QURAN_PAGES)),
  };

  return {
    greeting: {
      displayName,
      weekdayName: todayInfo.weekdayName,
      hijriDate: todayInfo.hijri,
      points: user.points,
      fullName: user.fullName ?? null,
      username: user.username,
      gregorianDate: todayInfo.gregorian,
    },
    prayers: {
      nextPrayer: prayers.nextPrayer
        ? {
            name: prayers.nextPrayer.name,
            nameAr: prayers.nextPrayer.nameAr,
            time: prayers.nextPrayer.time,
            displayAr: prayers.nextPrayer.displayAr,
            displayEn: prayers.nextPrayer.displayEn,
            iso: prayers.nextPrayer.iso,
            countdownSeconds: prayers.nextPrayer.countdownSeconds,
            key: prayers.nextPrayer.key,
          }
        : null,
      schedule: prayers.schedule.map((item) => ({
        name: item.name,
        nameAr: item.nameAr,
        time: item.time,
        displayAr: item.displayAr,
        displayEn: item.displayEn,
        iso: item.iso,
        completed: item.completed,
        key: item.key,
      })),
      date: prayers.date,
      timezone: prayers.timezone,
      completedCount: prayers.completedCount,
      totalCount: prayers.totalCount,
      latitude: prayers.latitude,
      longitude: prayers.longitude,
      city: prayers.city,
      cityAr: prayers.cityAr,
      country: prayers.country,
      countryAr: prayers.countryAr,
      calculationMethod: prayers.calculationMethod,
      madhab: prayers.madhab,
      locationSource: prayers.locationSource,
      isDefaultLocation: prayers.isDefaultLocation,
      sunrise: prayers.sunrise,
    },
    verseOfTheDay: {
      textAr: verse.textAr,
      referenceAr: verse.referenceAr,
      surahNumber: verse.surahNumber,
      ayahNumber: verse.ayahNumber,
    },
    hadithOfTheDay: {
      textAr: hadith.textAr,
      sourceAr: hadith.sourceAr,
    },
    dailyJourney: {
      prayer: {
        completed: prayers.completedCount,
        total: prayers.totalCount,
        progress: prayerProgress,
        labelAr: 'الصلوات',
        labelEn: 'Prayers',
        captionAr: `${prayers.completedCount} صلاة مكتملة اليوم`,
        captionEn: `${prayers.completedCount} prayers completed today`,
      },
      quran: {
        pagesRead: journey.quranPagesRead,
        target: 5,
        labelAr: 'القرآن',
        labelEn: 'Quran',
        captionAr: `${journey.quranPagesRead} صفحة مقروءة اليوم`,
        captionEn: `${journey.quranPagesRead} pages read today`,
      },
      adhkar: {
        completed: journey.adhkarCompleted,
        labelAr: 'الأذكار',
        labelEn: 'Adhkar',
        captionAr: journey.adhkarCompleted ? 'تم الانتهاء من وردك اليومي ✅' : 'اكمل وردك اليومي',
        captionEn: journey.adhkarCompleted ? 'Daily wird completed ✅' : 'Complete your daily wird',
      },
      sadaqah: {
        amount: Number(journey.sadaqahAmount) || 0,
        labelAr: 'الصدقة',
        labelEn: 'Sadaqah',
        captionAr: `${Number(journey.sadaqahAmount) || 0} ج.م مصدقة اليوم`,
        captionEn: `${Number(journey.sadaqahAmount) || 0} EGP donated today`,
        goal: DEFAULT_SADAQAH_GOAL_EGP,
        percent: sadaqahProgressPercent(Number(journey.sadaqahAmount) || 0),
        currency: SADAQAH_CURRENCY,
        currencyLabelAr: SADAQAH_CURRENCY_LABEL_AR,
        currencyLabelEn: SADAQAH_CURRENCY_LABEL_EN,
      },
    },
    khatmah: {
      surahId: surah?.id ?? 2,
      surahNameAr: resolveSurahNameAr(surah?.id ?? 2, surah?.nameAr) || 'البقرة',
      currentPage: khatmah?.currentPage ?? 1,
      progressPercent: khatmahPayload.progressPercent,
      surahNameEn: resolveSurahNameEn(surah?.id ?? 2, surah?.nameEn) || 'Al-Baqarah',
    },
    dailyChallenge: {
      titleAr: challengeTemplate?.titleAr ?? FALLBACK_CHALLENGE.titleAr,
      titleEn: challengeTemplate?.titleEn ?? FALLBACK_CHALLENGE.titleEn ?? 'Daily Challenge',
      descriptionAr: challengeTemplate?.descriptionAr ?? FALLBACK_CHALLENGE.descriptionAr,
      descriptionEn: challengeTemplate?.descriptionEn ?? FALLBACK_CHALLENGE.descriptionEn ?? 'Complete today\'s challenge to earn reward points.',
      rewardPoints: challengeTemplate?.rewardPoints ?? FALLBACK_CHALLENGE.rewardPoints,
      targetValue: challengeTemplate?.targetValue ?? FALLBACK_CHALLENGE.targetValue,
      completed: challengeCompleted,
      claimed: Boolean(challengeCompletion?.claimedAt),
    },
    utilities: {
      tasbih: { enabled: true },
      qibla: { enabled: true },
    },
  };
}

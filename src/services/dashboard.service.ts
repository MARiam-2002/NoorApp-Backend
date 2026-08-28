import type { ChallengeType, PrayerName } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { calculateDailyPrayerSchedule } from './prayer.service';
import type { DailyPrayerSchedule } from './prayer.service';
import { formatArabicDateInfo, getDayOfYear, getTodayDateOnly } from '../utils/date';
import { isDailyChallengeCompleted } from '../utils/challenge';
import { DefaultTimezone, PrayerNameEnum } from '../utils/constants';
import { ensureSurahCatalog } from '../lib/quran-catalog';
import {
  FALLBACK_VERSE,
  FALLBACK_HADITH,
  FALLBACK_CHALLENGE,
} from '../shared/constants/fallbacks';
import {
  getTodayJourneyWithFallback,
  getVerseOfTheDayLite,
  getHadithOfTheDayLite,
  getDailyChallengeTemplate,
} from './daily-content.service';

const DEFAULT_LATITUDE = 30.0444;
const DEFAULT_LONGITUDE = 31.2357;
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
    } | null;
    schedule: Array<{
      name: string;
      nameAr: string;
      time: string;
      displayAr?: string;
      displayEn?: string;
      iso?: string;
      completed: boolean;
    }>;
    date?: string;
    timezone?: string;
    completedCount?: number;
    totalCount?: number;
  };
  verseOfTheDay: {
    textAr: string;
    referenceAr: string;
    surahNumber?: number;
    ayahNumber?: number;
  };
  hadithOfTheDay: { textAr: string; sourceAr: string };
  dailyJourney: {
    prayer: { completed: number; total: number; progress: number };
    quran: { pagesRead: number };
    adhkar: { completed: boolean };
    sadaqah: { amount: number };
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
    descriptionAr: string;
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
      },
    });
    if (fetched) user = fetched;
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
        schedule: [],
        date: new Date().toISOString().slice(0, 10),
        timezone: user.timezone ?? DefaultTimezone,
        completedCount: 0,
        totalCount: 5,
      },
      verseOfTheDay: FALLBACK_VERSE,
      hadithOfTheDay: FALLBACK_HADITH,
      dailyJourney: {
        prayer: { completed: 0, total: 5, progress: 0 },
        quran: { pagesRead: 0 },
        adhkar: { completed: false },
        sadaqah: { amount: 0 },
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
        descriptionAr: FALLBACK_CHALLENGE.descriptionAr,
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
    getHadithOfTheDayLite(dayOfYear).catch(() => FALLBACK_HADITH),
    getDailyChallengeTemplate(dayOfYear).catch(() => null),
    getChallengeCompletion(userId, dayOfYear).catch(() => null),
  ]);

  const surah = khatmah?.currentSurahId
    ? await getSurah(khatmah.currentSurahId)
    : null;

  const latitude = user.latitude ?? DEFAULT_LATITUDE;
  const longitude = user.longitude ?? DEFAULT_LONGITUDE;
  const timezone = user.timezone ?? DefaultTimezone;

  let prayers: DailyPrayerSchedule;
  try {
    prayers = calculateDailyPrayerSchedule(
      latitude,
      longitude,
      timezone,
      completedPrayers as PrayerNameEnum[],
    );
  } catch {
    prayers = {
      date: new Date().toISOString().slice(0, 10),
      timezone: DefaultTimezone,
      nextPrayer: null,
      schedule: [],
      completedCount: 0,
      totalCount: 5,
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
    surahNameEn: surah?.nameEn ?? 'Al-Baqarah',
    surahNameAr: surah?.nameAr ?? 'البقرة',
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
      })),
      date: prayers.date,
      timezone: prayers.timezone,
      completedCount: prayers.completedCount,
      totalCount: prayers.totalCount,
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
      },
      quran: { pagesRead: journey.quranPagesRead },
      adhkar: { completed: journey.adhkarCompleted },
      sadaqah: { amount: Number(journey.sadaqahAmount) || 0 },
    },
    khatmah: {
      surahId: surah?.id ?? 2,
      surahNameAr: surah?.nameAr ?? 'البقرة',
      currentPage: khatmah?.currentPage ?? 1,
      progressPercent: khatmahPayload.progressPercent,
      surahNameEn: surah?.nameEn ?? 'Al-Baqarah',
    },
    dailyChallenge: {
      titleAr: challengeTemplate?.titleAr ?? FALLBACK_CHALLENGE.titleAr,
      descriptionAr: challengeTemplate?.descriptionAr ?? FALLBACK_CHALLENGE.descriptionAr,
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

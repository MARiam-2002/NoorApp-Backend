import type { ChallengeType, PrayerName } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { calculateDailyPrayerSchedule } from './prayer.service';
import type { DailyPrayerSchedule } from './prayer.service';
import { getDayOfYear, getTodayDateOnly } from '../utils/date';
import { isDailyChallengeCompleted } from '../utils/challenge';
import { DefaultTimezone, PrayerNameEnum } from '../utils/constants';

const DEFAULT_LATITUDE = 30.0444;
const DEFAULT_LONGITUDE = 31.2357;
const TOTAL_QURAN_PAGES = 604;

export type DashboardData = {
  greeting: { username: string; points: number };
  prayers: DailyPrayerSchedule;
  verseOfTheDay: {
    textAr: string;
    referenceAr: string;
    surahNumber: number;
    ayahNumber: number;
  } | null;
  hadithOfTheDay: { textAr: string; sourceAr: string } | null;
  dailyJourney: {
    prayer: { completed: number; total: number; progress: number };
    quran: { pagesRead: number };
    adhkar: { completed: boolean };
    sadaqah: { amount: number };
  };
  khatmah: {
    surahId: number;
    surahNameEn: string;
    surahNameAr: string;
    currentPage: number;
    progressPercent: number;
  } | null;
  dailyChallenge: {
    titleAr: string;
    descriptionAr: string;
    rewardPoints: number;
    targetValue: number;
    completed: boolean;
    claimed: boolean;
  } | null;
  utilities: { qibla: { enabled: true }; tasbih: { enabled: true } };
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

async function getOrCreateTodayJourney(userId: string, date: Date = getTodayDateOnly()) {
  return prisma.dailyProgress.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: {},
  });
}

async function getOrCreateKhatmah(userId: string) {
  return prisma.khatmah.upsert({
    where: { userId },
    create: { userId, currentSurahId: 2, currentPage: 1 },
    update: {},
    include: { user: false },
  });
}

async function getSurah(surahId: number) {
  return prisma.surah.findUnique({ where: { id: surahId } });
}

async function getVerseOfTheDay(dayOfYear: number) {
  return prisma.verseOfTheDay.findFirst({
    where: { dayOfYear },
  });
}

async function getHadithOfTheDay(dayOfYear: number) {
  return prisma.hadithOfTheDay.findFirst({
    where: { dayOfYear },
  });
}

async function getDailyChallengeTemplate(dayOfYear: number) {
  return prisma.dailyChallengeTemplate.findFirst({
    where: { dayOfYear },
  });
}

async function getChallengeCompletion(userId: string, dayOfYear: number) {
  return prisma.challengeCompletion.findUnique({
    where: { userId_dayOfYear: { userId, dayOfYear } },
  });
}

export async function getDashboard(userId: string): Promise<DashboardData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      points: true,
      timezone: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  const dayOfYear = getDayOfYear();

  const [
    completedPrayers,
    journey,
    khatmah,
    verse,
    hadith,
    challengeTemplate,
    challengeCompletion,
  ] = await Promise.all([
    findCompletedPrayers(userId),
    getOrCreateTodayJourney(userId),
    getOrCreateKhatmah(userId),
    getVerseOfTheDay(dayOfYear),
    getHadithOfTheDay(dayOfYear),
    getDailyChallengeTemplate(dayOfYear),
    getChallengeCompletion(userId, dayOfYear),
  ]);

  const surah = khatmah.currentSurahId ? await getSurah(khatmah.currentSurahId) : null;

  const latitude = user.latitude ?? DEFAULT_LATITUDE;
  const longitude = user.longitude ?? DEFAULT_LONGITUDE;
  const timezone = user.timezone ?? DefaultTimezone;

  const prayers = calculateDailyPrayerSchedule(
    latitude,
    longitude,
    timezone,
    completedPrayers as PrayerNameEnum[],
  );

  const prayerProgress =
    prayers.totalCount > 0
      ? Math.round((prayers.completedCount / prayers.totalCount) * 100)
      : 0;

  const challengeCompleted = challengeTemplate
    ? isDailyChallengeCompleted(
        challengeTemplate.type as ChallengeType,
        challengeTemplate.targetValue,
        {
          quranPagesRead: journey.quranPagesRead,
          adhkarCompleted: journey.adhkarCompleted,
          sadaqahAmount: journey.sadaqahAmount,
        },
        completedPrayers,
      )
    : false;

  return {
    greeting: {
      username: user.username,
      points: user.points,
    },
    prayers,
    verseOfTheDay: verse
      ? {
          textAr: verse.textAr,
          referenceAr: verse.referenceAr,
          surahNumber: verse.surahNumber,
          ayahNumber: verse.ayahNumber,
        }
      : null,
    hadithOfTheDay: hadith
      ? {
          textAr: hadith.textAr,
          sourceAr: hadith.sourceAr,
        }
      : null,
    dailyJourney: {
      prayer: {
        completed: prayers.completedCount,
        total: prayers.totalCount,
        progress: prayerProgress,
      },
      quran: { pagesRead: journey.quranPagesRead },
      adhkar: { completed: journey.adhkarCompleted },
      sadaqah: { amount: Number(journey.sadaqahAmount) },
    },
    khatmah: surah
      ? {
          surahId: surah.id,
          surahNameEn: surah.nameEn,
          surahNameAr: surah.nameAr,
          currentPage: khatmah.currentPage,
          progressPercent: Math.round((khatmah.totalPagesRead / TOTAL_QURAN_PAGES) * 100),
        }
      : null,
    dailyChallenge: challengeTemplate
      ? {
          titleAr: challengeTemplate.titleAr,
          descriptionAr: challengeTemplate.descriptionAr,
          rewardPoints: challengeTemplate.rewardPoints,
          targetValue: challengeTemplate.targetValue,
          completed: challengeCompleted,
          claimed: Boolean(challengeCompletion?.claimedAt),
        }
      : null,
    utilities: {
      qibla: { enabled: true },
      tasbih: { enabled: true },
    },
  };
}

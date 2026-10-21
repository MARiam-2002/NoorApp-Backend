import type { ChallengeType, PrayerName } from '@prisma/client';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { getTodayDateOnly } from '../utils/date';
import { calendarDayOfYear, getUserLocalCalendarDay } from '../shared/utils/user-local-date';
import { isDailyChallengeCompleted } from '../utils/challenge';
import {
  assertValidDayOfYear,
  getOrCreateTodayJourney,
  getDailyChallengeTemplateWithFallback,
} from './daily-content.service';
import { FALLBACK_CHALLENGE } from '../shared/constants/fallbacks';
import { getJourneyLevelProgress } from '../shared/constants/journey-levels';

type JourneySnapshot = {
  quranPagesRead: number;
  adhkarCompleted: boolean;
  sadaqahAmount: unknown;
};

async function getOrCreateToday(userId: string, date = getTodayDateOnly()) {
  return getOrCreateTodayJourney(userId, date);
}

async function findCompletedPrayers(userId: string, date = getTodayDateOnly()): Promise<PrayerName[]> {
  const records = await prisma.prayerCompletion.findMany({
    where: { userId, date },
    select: { prayer: true },
  });
  return records.map((record) => record.prayer);
}

export async function getChallengeByDay(userId: string, dayOfYear: number) {
  assertValidDayOfYear(dayOfYear);
  const { date } = await getUserLocalCalendarDay(userId);
  const year = date.getUTCFullYear();
  const template = await getDailyChallengeTemplateWithFallback(dayOfYear);
  const completion = await prisma.challengeCompletion.findUnique({
    where: { userId_year_dayOfYear: { userId, year, dayOfYear } },
  });

  const journey = await getOrCreateToday(userId, date);
  const completedPrayers = await findCompletedPrayers(userId, date);

  return {
    id: String(dayOfYear),
    dayOfYear,
    titleAr: template.titleAr ?? FALLBACK_CHALLENGE.titleAr,
    titleEn: template.titleEn ?? FALLBACK_CHALLENGE.titleEn,
    descriptionAr: template.descriptionAr ?? FALLBACK_CHALLENGE.descriptionAr,
    descriptionEn: template.descriptionEn ?? FALLBACK_CHALLENGE.descriptionEn,
    type: template.type,
    targetValue: template.targetValue,
    rewardPoints: template.rewardPoints,
    completed: isDailyChallengeCompleted(
      template.type,
      template.targetValue,
      journey as unknown as JourneySnapshot,
      completedPrayers,
    ),
    claimed: Boolean(completion?.claimedAt),
  };
}

export async function getTodayChallenge(userId: string) {
  return getChallengeByDay(userId, calendarDayOfYear((await getUserLocalCalendarDay(userId)).date));
}

export async function getAllChallenges(userId: string) {
  const todayDay = calendarDayOfYear((await getUserLocalCalendarDay(userId)).date);
  const today = await getChallengeByDay(userId, todayDay);

  return {
    current: today,
    dayOfYear: todayDay,
  };
}

export async function claimChallenge(userId: string, dayOfYearStr: string) {
  const dayOfYear = Number(dayOfYearStr);
  const { date } = await getUserLocalCalendarDay(userId);
  const year = date.getUTCFullYear();
  if (!/^\d{1,3}$/.test(dayOfYearStr) || dayOfYear !== calendarDayOfYear(date)) {
    throw new AppError("Only today's challenge can be claimed", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }

  const template = await getDailyChallengeTemplateWithFallback(dayOfYear);

  const journey = await getOrCreateToday(userId, date);
  const completedPrayers = await findCompletedPrayers(userId, date);
  const isCompleted = isDailyChallengeCompleted(
    template.type,
    template.targetValue,
    journey as unknown as JourneySnapshot,
    completedPrayers,
  );

  if (!isCompleted) {
    throw new AppError(
      'Challenge requirements not met yet',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const [updatedCompletion, updatedUser] = await prisma.$transaction(async tx => {
    // Serialize per account; the unique annual key also prevents duplicate rows.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const existing = await tx.challengeCompletion.findUnique({
      where: { userId_year_dayOfYear: { userId, year, dayOfYear } },
    });
    if (existing?.claimedAt) {
      throw new AppError('Challenge reward already claimed', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    }
    const claimedAt = new Date();
    const completion = await tx.challengeCompletion.upsert({
      where: { userId_year_dayOfYear: { userId, year, dayOfYear } },
      create: { userId, year, dayOfYear, completedAt: claimedAt, claimedAt },
      update: { completedAt: claimedAt, claimedAt },
    });
    const user = await tx.user.update({ where: { id: userId },
      data: { points: { increment: template.rewardPoints } }, select: { points: true, level: true } });
    return [completion, user] as const;
  });

  // Keep User.level aligned with the Journey points ladder (same helper as /journey/today).
  const levelProgress = getJourneyLevelProgress(updatedUser.points);
  if (updatedUser.level !== levelProgress.level) {
    await prisma.user.update({
      where: { id: userId },
      data: { level: levelProgress.level },
    }).catch(() => undefined);
  }

  try {
    await prisma.notification.create({
      data: {
        userId,
        titleAr: 'تم استلام مكافأة التحدي',
        titleEn: 'Challenge reward claimed',
        bodyAr: `حصلت على ${template.rewardPoints} نقطة من تحدي اليوم`,
        bodyEn: `You earned ${template.rewardPoints} points from today's challenge`,
        type: 'CHALLENGE',
        deepLink: '/challenges',
        payload: {
          dayOfYear,
          rewardPoints: template.rewardPoints,
        },
      },
    });
  } catch {
    // Non-fatal: claim still succeeds if notifications table is unavailable
  }

  return {
    id: String(dayOfYear),
    titleAr: template.titleAr ?? FALLBACK_CHALLENGE.titleAr,
    titleEn: template.titleEn ?? FALLBACK_CHALLENGE.titleEn,
    descriptionAr: template.descriptionAr ?? FALLBACK_CHALLENGE.descriptionAr,
    descriptionEn: template.descriptionEn ?? FALLBACK_CHALLENGE.descriptionEn,
    rewardPoints: template.rewardPoints,
    pointsAwarded: template.rewardPoints,
    claimed: true,
    claimedAt: updatedCompletion.claimedAt,
  };
}

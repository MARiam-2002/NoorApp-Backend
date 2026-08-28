import type { ChallengeType, PrayerName } from '@prisma/client';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { getDayOfYear, getTodayDateOnly } from '../utils/date';
import { isDailyChallengeCompleted } from '../utils/challenge';
import {
  getOrCreateTodayJourney,
  getDailyChallengeTemplate,
} from './daily-content.service';

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
  const template = await getDailyChallengeTemplate(dayOfYear);
  const completion = await prisma.challengeCompletion.findUnique({
    where: { userId_dayOfYear: { userId, dayOfYear } },
  });

  if (!template) {
    return null;
  }

  const journey = await getOrCreateToday(userId);
  const completedPrayers = await findCompletedPrayers(userId);

  return {
    id: String(dayOfYear),
    dayOfYear,
    titleAr: template.titleAr,
    descriptionAr: template.descriptionAr,
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
  return getChallengeByDay(userId, getDayOfYear());
}

export async function getAllChallenges(userId: string) {
  const todayDay = getDayOfYear();
  const today = await getChallengeByDay(userId, todayDay);

  return {
    current: today,
    dayOfYear: todayDay,
  };
}

export async function claimChallenge(userId: string, dayOfYearStr: string) {
  const dayOfYear = Number(dayOfYearStr);
  const template = await getDailyChallengeTemplate(dayOfYear);

  if (!template) {
    throw new AppError(
      'No challenge available for this day',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  const journey = await getOrCreateToday(userId);
  const completedPrayers = await findCompletedPrayers(userId);
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

  const existingCompletion = await prisma.challengeCompletion.findUnique({
    where: { userId_dayOfYear: { userId, dayOfYear } },
  });

  if (existingCompletion?.claimedAt) {
    throw new AppError(
      'Challenge reward already claimed',
      HttpStatus.CONFLICT,
      ErrorCodes.CONFLICT,
    );
  }

  const [updatedCompletion] = await prisma.$transaction([
    prisma.challengeCompletion.upsert({
      where: { userId_dayOfYear: { userId, dayOfYear } },
      create: {
        userId,
        dayOfYear,
        completedAt: new Date(),
        claimedAt: new Date(),
      },
      update: {
        completedAt: new Date(),
        claimedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { points: { increment: template.rewardPoints } },
    }),
  ]);

  return {
    id: String(dayOfYear),
    rewardPoints: template.rewardPoints,
    pointsAwarded: template.rewardPoints,
    claimed: true,
    claimedAt: updatedCompletion.claimedAt,
  };
}

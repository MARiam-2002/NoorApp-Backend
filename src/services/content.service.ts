import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { logger } from '../lib/logger';

function getDayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export async function getVerseOfDay(dayOfYear = getDayOfYear()) {
  let verse = await prisma.verseOfTheDay.findFirst({
    where: { dayOfYear },
    include: {
      surah: {
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
        },
      },
    },
  });

  if (!verse) {
    logger.warn('No verse of the day found, returning default', { dayOfYear });
    // Return default verse
    verse = {
      id: 'default-' + dayOfYear,
      dayOfYear,
      surahNumber: 2,
      ayahNumber: 255,
      textAr: 'الله لا إله إلا هو الحي القيوم',
      referenceAr: 'سورة البقرة - آية الكرسي',
      surah: {
        id: 2,
        nameEn: 'Al-Baqarah',
        nameAr: 'سورة البقرة',
      },
    };
  }

  return verse;
}

export async function getHadithOfDay(dayOfYear = getDayOfYear()) {
  let hadith = await prisma.hadithOfTheDay.findFirst({
    where: { dayOfYear },
  });

  if (!hadith) {
    logger.warn('No hadith of the day found, returning default', { dayOfYear });
    // Return default hadith
    hadith = {
      id: 'default-' + dayOfYear,
      dayOfYear,
      textAr: 'إن الله مع الصابرين',
      sourceAr: 'صحيح البخاري',
    };
  }

  return hadith;
}

export async function getDailyChallenge(dayOfYear = getDayOfYear()) {
  return prisma.dailyChallengeTemplate.findFirst({
    where: { dayOfYear },
  });
}

export async function getVerseOfDayByDay(day: number) {
  if (day < 1 || day > 366) {
    throw new AppError(
      'Invalid day of year (must be between 1 and 366)',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  return getVerseOfDay(day);
}

export async function getHadithOfDayByDay(day: number) {
  if (day < 1 || day > 366) {
    throw new AppError(
      'Invalid day of year (must be between 1 and 366)',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  return getHadithOfDay(day);
}

export async function getDailyChallengeByDay(day: number) {
  if (day < 1 || day > 366) {
    throw new AppError(
      'Invalid day of year (must be between 1 and 366)',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  return getDailyChallenge(day);
}

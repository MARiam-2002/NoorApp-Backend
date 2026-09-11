import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { logger } from '../lib/logger';
import { getDayOfYear, getTodayDateOnly } from '../utils/date';
import {
  FALLBACK_VERSE,
  FALLBACK_VERSE_FULL_SURAH,
  FALLBACK_CHALLENGE,
  DAILY_JOURNEY_FALLBACK,
  DAY_OF_YEAR_MIN,
  DAY_OF_YEAR_MAX,
} from '../shared/constants/fallbacks';
import { getCuratedHadithForDay } from '../shared/constants/curated-hadiths';

export function isValidDayOfYear(day: number): boolean {
  return Number.isInteger(day) && day >= DAY_OF_YEAR_MIN && day <= DAY_OF_YEAR_MAX;
}

export function assertValidDayOfYear(day: number, label = 'day of year'): void {
  if (!isValidDayOfYear(day)) {
    throw new AppError(
      `Invalid ${label} (must be between ${DAY_OF_YEAR_MIN} and ${DAY_OF_YEAR_MAX})`,
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }
}

export async function getVerseOfTheDay(dayOfYear = getDayOfYear()) {
  const stored = await prisma.verseOfTheDay.findFirst({
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

  if (stored) return stored;

  logger.warn('No VerseOfTheDay row in DB, returning unified fallback', { dayOfYear });
  return {
    id: `fallback-verse-${dayOfYear}`,
    dayOfYear,
    surahNumber: FALLBACK_VERSE.surahNumber,
    ayahNumber: FALLBACK_VERSE.ayahNumber,
    textAr: FALLBACK_VERSE.textAr,
    referenceAr: FALLBACK_VERSE.referenceAr,
    surah: {
      id: FALLBACK_VERSE_FULL_SURAH.id,
      nameAr: FALLBACK_VERSE_FULL_SURAH.nameAr,
      nameEn: FALLBACK_VERSE_FULL_SURAH.nameEn,
    },
  };
}

export async function getVerseOfTheDayLite(dayOfYear = getDayOfYear()) {
  const stored = await prisma.verseOfTheDay.findFirst({
    where: { dayOfYear },
  });
  if (stored) {
    return {
      textAr: stored.textAr,
      referenceAr: stored.referenceAr ?? FALLBACK_VERSE.referenceAr,
      surahNumber: stored.surahNumber,
      ayahNumber: stored.ayahNumber,
    };
  }

  const ayah = await prisma.ayah
    .findUnique({
      where: { surahId_ayahNumber: { surahId: FALLBACK_VERSE.surahNumber, ayahNumber: FALLBACK_VERSE.ayahNumber } },
      include: { surah: { select: { nameAr: true } } },
    })
    .catch(() => null);

  if (ayah) {
    return {
      textAr: ayah.textAr,
      referenceAr: `آية الكرسي — ${ayah.surah?.nameAr ?? 'سورة البقرة'}`,
      surahNumber: FALLBACK_VERSE.surahNumber,
      ayahNumber: FALLBACK_VERSE.ayahNumber,
    };
  }

  logger.warn('No VerseOfTheDay and no Ayah fallback, returning hardcoded FALLBACK_VERSE', { dayOfYear });
  return FALLBACK_VERSE;
}

export async function getHadithOfTheDay(dayOfYear = getDayOfYear()) {
  const year = new Date().getFullYear();
  const curated = getCuratedHadithForDay(dayOfYear, year);

  // Prefer verified Sahihayn bank as source of truth (never serve stale/unverified DB text).
  try {
    const stored = await prisma.hadithOfTheDay.findFirst({ where: { dayOfYear } });
    if (
      stored &&
      stored.textAr === curated.textAr &&
      stored.sourceAr === curated.sourceAr
    ) {
      return stored;
    }

    return await prisma.hadithOfTheDay.upsert({
      where: { dayOfYear },
      create: {
        dayOfYear,
        textAr: curated.textAr,
        sourceAr: curated.sourceAr,
      },
      update: {
        textAr: curated.textAr,
        sourceAr: curated.sourceAr,
      },
    });
  } catch (err) {
    logger.warn('HadithOfTheDay DB upsert failed, returning verified bank entry', {
      dayOfYear,
      err: err instanceof Error ? err.message : String(err),
    });
    return {
      id: `verified-hadith-${year}-${dayOfYear}`,
      dayOfYear,
      textAr: curated.textAr,
      sourceAr: curated.sourceAr,
    };
  }
}

export async function getHadithOfTheDayLite(dayOfYear = getDayOfYear()) {
  const year = new Date().getFullYear();
  // Deterministic verified selection — stable same day; no unverified static fallback.
  return getCuratedHadithForDay(dayOfYear, year);
}

export async function getDailyChallengeTemplate(dayOfYear = getDayOfYear()) {
  const template = await prisma.dailyChallengeTemplate.findFirst({
    where: { dayOfYear },
  });
  return template ?? null;
}

export async function getDailyChallengeTemplateWithFallback(dayOfYear = getDayOfYear()) {
  const template = await getDailyChallengeTemplate(dayOfYear);
  if (template) return template;
  logger.warn('No DailyChallengeTemplate in DB, returning unified fallback', { dayOfYear });
  return {
    id: `fallback-challenge-${dayOfYear}`,
    dayOfYear,
    ...FALLBACK_CHALLENGE,
  };
}

export async function getOrCreateTodayJourney(userId: string, date = getTodayDateOnly()) {
  return prisma.dailyProgress.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: {},
  });
}

export async function getTodayJourneyWithFallback(userId: string, date = getTodayDateOnly()) {
  try {
    return await getOrCreateTodayJourney(userId, date);
  } catch {
    logger.warn('DailyProgress upsert failed, returning in-memory fallback', { userId });
    return DAILY_JOURNEY_FALLBACK;
  }
}

export async function getHadithLite(dayOfYear = getDayOfYear()) {
  return getHadithOfTheDayLite(dayOfYear);
}

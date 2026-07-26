import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { parsePaginationQuery, buildPaginationMeta } from '../utils/pagination';

const TOTAL_QURAN_PAGES = 604;

export async function listSurahs() {
  return prisma.surah.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      totalAyahs: true,
      totalPages: true,
    },
  });
}

export async function getSurah(surahId: number) {
  const surah = await prisma.surah.findUnique({
    where: { id: surahId },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      totalAyahs: true,
      totalPages: true,
    },
  });

  if (!surah) {
    throw new AppError('Surah not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  return surah;
}

export async function listAyahs(surahId: number, page?: number, limit?: number) {
  const pagination = parsePaginationQuery(page, limit);
  const [items, total] = await Promise.all([
    prisma.ayah.findMany({
      where: { surahId },
      orderBy: { ayahNumber: 'asc' },
      skip: pagination.skip,
      take: pagination.limit,
      select: {
        id: true,
        surahId: true,
        ayahNumber: true,
        textAr: true,
        page: true,
        juz: true,
      },
    }),
    prisma.ayah.count({ where: { surahId } }),
  ]);

  return {
    items,
    meta: buildPaginationMeta(pagination.page, pagination.limit, total),
  };
}

export async function listBookmarks(userId: string) {
  return prisma.quranBookmark.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      surah: {
        select: { id: true, nameEn: true, nameAr: true },
      },
    },
  });
}

export async function createBookmark(userId: string, surahId: number, ayahNumber: number, note?: string) {
  const surah = await prisma.surah.findUnique({ where: { id: surahId } });

  if (!surah) {
    throw new AppError('Surah not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  if (ayahNumber < 1 || ayahNumber > surah.totalAyahs) {
    throw new AppError(
      `Invalid ayah number. Surah ${surah.nameEn} has ${surah.totalAyahs} ayahs`,
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  return prisma.quranBookmark.create({
    data: { userId, surahId, ayahNumber, note },
    include: {
      surah: {
        select: { id: true, nameEn: true, nameAr: true },
      },
    },
  });
}

export async function deleteBookmark(userId: string, bookmarkId: string) {
  const result = await prisma.quranBookmark.deleteMany({
    where: { id: bookmarkId, userId },
  });

  if (result.count === 0) {
    throw new AppError('Bookmark not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }
}

export async function getLastRead(userId: string) {
  return prisma.quranLastRead.findUnique({
    where: { userId },
    include: {
      surah: {
        select: { id: true, nameEn: true, nameAr: true },
      },
    },
  });
}

export async function updateLastRead(userId: string, surahId: number, ayahNumber: number, page?: number) {
  const surah = await prisma.surah.findUnique({ where: { id: surahId } });

  if (!surah) {
    throw new AppError('Surah not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  if (ayahNumber < 1 || ayahNumber > surah.totalAyahs) {
    throw new AppError(
      `Invalid ayah number. Surah ${surah.nameEn} has ${surah.totalAyahs} ayahs`,
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  if (page && (page < 1 || page > TOTAL_QURAN_PAGES)) {
    throw new AppError(
      `Invalid page number. Quran has ${TOTAL_QURAN_PAGES} pages`,
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  return prisma.quranLastRead.upsert({
    where: { userId },
    create: { userId, surahId, ayahNumber, page },
    update: { surahId, ayahNumber, page },
    include: {
      surah: {
        select: { id: true, nameEn: true, nameAr: true },
      },
    },
  });
}

export async function listReadingHistory(userId: string, page?: number, limit?: number) {
  const pagination = parsePaginationQuery(page, limit);
  const [items, total] = await Promise.all([
    prisma.quranReadingHistory.findMany({
      where: { userId },
      orderBy: { readAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      select: {
        id: true,
        surahId: true,
        ayahFrom: true,
        ayahTo: true,
        readAt: true,
      },
    }),
    prisma.quranReadingHistory.count({ where: { userId } }),
  ]);

  return {
    items,
    meta: buildPaginationMeta(pagination.page, pagination.limit, total),
  };
}

export async function recordReadingHistory(userId: string, surahId: number, ayahFrom: number, ayahTo: number, page?: number) {
  const surah = await prisma.surah.findUnique({ where: { id: surahId } });

  if (!surah) {
    throw new AppError('Surah not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  if (ayahFrom > ayahTo) {
    throw new AppError('Invalid ayah range', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }

  const [history] = await Promise.all([
    prisma.quranReadingHistory.create({
      data: { userId, surahId, ayahFrom, ayahTo },
    }),
    prisma.quranLastRead.upsert({
      where: { userId },
      create: { userId, surahId, ayahNumber: ayahTo, page },
      update: { surahId, ayahNumber: ayahTo, page },
    }),
  ]);

  return history;
}

export async function getKhatmah(userId: string) {
  const khatmah = await prisma.khatmah.upsert({
    where: { userId },
    create: { userId, currentSurahId: 2, currentPage: 1 },
    update: {},
  });
  const surah = await prisma.surah.findUnique({ where: { id: khatmah.currentSurahId } });

  return {
    surahId: khatmah.currentSurahId,
    surahNameEn: surah?.nameEn ?? 'Al-Baqarah',
    surahNameAr: surah?.nameAr ?? 'سورة البقرة',
    currentPage: khatmah.currentPage,
    totalPagesRead: khatmah.totalPagesRead,
    progressPercent: Math.round((khatmah.totalPagesRead / TOTAL_QURAN_PAGES) * 100),
  };
}

export async function updateKhatmah(userId: string, surahId: number, page: number, pagesRead = 1) {
  if (surahId < 1 || page < 1 || pagesRead < 1) {
    throw new AppError(
      'Invalid khatmah progress',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const existing = await prisma.khatmah.upsert({
    where: { userId },
    create: { userId, currentSurahId: 2, currentPage: 1 },
    update: {},
  });

  const khatmah = await prisma.khatmah.update({
    where: { userId },
    data: {
      currentSurahId: surahId,
      currentPage: page,
      totalPagesRead: existing.totalPagesRead + pagesRead,
    },
  });
  const surah = await prisma.surah.findUnique({ where: { id: khatmah.currentSurahId } });

  return {
    surahId: khatmah.currentSurahId,
    surahNameEn: surah?.nameEn ?? 'Al-Baqarah',
    surahNameAr: surah?.nameAr ?? 'سورة البقرة',
    currentPage: khatmah.currentPage,
    totalPagesRead: khatmah.totalPagesRead,
    progressPercent: Math.round((khatmah.totalPagesRead / TOTAL_QURAN_PAGES) * 100),
  };
}

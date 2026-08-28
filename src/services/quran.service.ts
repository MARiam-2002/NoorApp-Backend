import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { ensureSurahCatalog, FALLBACK_KHATMAH } from '../lib/quran-catalog';
import { parsePaginationQuery, buildPaginationMeta } from '../utils/pagination';
import { getTodayDateOnly } from '../utils/date';

const TOTAL_QURAN_PAGES = 604;

const AR_DIACRITICS =
  '\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD';

const BOM = '\uFEFF';
const BISMILLAH_REGEX = new RegExp(
  '^(?:' + BOM + ')?' +
    'ب' + '[' + AR_DIACRITICS + ']*' +
    'س' + '[' + AR_DIACRITICS + ']*' +
    'م' + '[' + AR_DIACRITICS + ']*' +
    '[\\s\\u200C-\\u200F\\u202A-\\u202E\\u00A0]+' +
    '[\\u0671\\u0627]?' +
    'ل' + '[' + AR_DIACRITICS + ']*' +
    'ل' + '[' + AR_DIACRITICS + ']*' +
    'ه' + '[' + AR_DIACRITICS + ']*' +
    '[\\s\\u200C-\\u200F\\u202A-\\u202E\\u00A0]+' +
    '[\\u0671\\u0627]?' +
    'ل' + '[' + AR_DIACRITICS + ']*' +
    'ر' + '[' + AR_DIACRITICS + ']*' +
    'ح' + '[' + AR_DIACRITICS + ']*' +
    'م' + '[' + AR_DIACRITICS + ']*' +
    '[\\u0622\\u0623\\u0625\\u0627\\u0671]?' +
    'ن' + '[' + AR_DIACRITICS + ']*' +
    'ي' + '?' +
    '[' + AR_DIACRITICS + ']*' +
    '[\\s\\u200C-\\u200F\\u202A-\\u202E\\u00A0]+' +
    '[\\u0671\\u0627]?' +
    'ل' + '[' + AR_DIACRITICS + ']*' +
    'ر' + '[' + AR_DIACRITICS + ']*' +
    'ح' + '[' + AR_DIACRITICS + ']*' +
    'ي' + '[' + AR_DIACRITICS + ']*' +
    'م' + '[' + AR_DIACRITICS + ']*' +
    '(?:[\\s\\u200C-\\u200F\\u202A-\\u202E\\u00A0]+|$)',
  'u',
);

function stripBom(text: string): string {
  if (text && text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

function stripSurahOpeningBismillahIfNeeded(ayah: {
  surahId: number;
  ayahNumber: number;
  textAr: string;
}): string {
  if (ayah.ayahNumber !== 1) return stripBom(ayah.textAr ?? '');
  if (ayah.surahId === 1 || ayah.surahId === 9) return stripBom(ayah.textAr ?? '');
  const text = stripBom(ayah.textAr ?? '');
  return text.replace(BISMILLAH_REGEX, '');
}

function sanitizeAyahText<T extends { surahId: number; ayahNumber: number; textAr: string }>(
  ayah: T,
): T {
  const stripped = stripSurahOpeningBismillahIfNeeded(ayah);
  if (stripped === ayah.textAr) return ayah;
  return { ...ayah, textAr: stripped };
}

function sanitizeAyahList<
  T extends { surahId: number; ayahNumber: number; textAr: string },
>(ayahs: T[]): T[] {
  if (!ayahs || ayahs.length === 0) return ayahs;
  return ayahs.map(sanitizeAyahText);
}

function formatKhatmah(
  khatmah: { currentSurahId: number; currentPage: number; totalPagesRead: number },
  surah: { nameEn: string; nameAr: string } | null,
  extra: Record<string, unknown> = {},
) {
  const totalPagesRead = khatmah.totalPagesRead;
  const progressPercent = Math.min(
    100,
    Math.round((totalPagesRead * 100) / TOTAL_QURAN_PAGES),
  );

  return {
    surahId: khatmah.currentSurahId,
    surahNameEn: surah?.nameEn ?? FALLBACK_KHATMAH.surahNameEn,
    surahNameAr: surah?.nameAr ?? FALLBACK_KHATMAH.surahNameAr,
    currentPage: Math.min(Math.max(khatmah.currentPage, 1), TOTAL_QURAN_PAGES),
    totalPagesRead,
    progressPercent,
    ...extra,
  };
}

function serializeBookmark(
  row: {
    id: string;
    userId: string;
    surahId: number;
    ayahNumber: number | null;
    page: number | null;
    note: string | null;
    createdAt: Date;
    surah?: { id: number; nameEn: string; nameAr: string } | null;
  },
  textAr: string | null,
) {
  const sanitizedTextAr: string | null =
    textAr != null && row.surahId != null && row.ayahNumber != null
      ? stripSurahOpeningBismillahIfNeeded({
          surahId: row.surahId,
          ayahNumber: row.ayahNumber,
          textAr,
        })
      : textAr;
  const surahObj = row.surah ?? {
    id: row.surahId,
    nameEn: 'Unknown',
    nameAr: 'غير معروف',
  };
  return {
    id: row.id,
    userId: row.userId,
    surahId: row.surahId,
    ayahNumber: row.ayahNumber,
    page: row.page,
    note: row.note,
    textAr: sanitizedTextAr,
    surahNameAr: surahObj.nameAr,
    surah: surahObj,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listSurahs() {
  const [surahs, firstPages] = await Promise.all([
    prisma.surah.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        totalAyahs: true,
        totalPages: true,
        revelationType: true,
      },
    }),
    prisma.ayah.groupBy({
      by: ['surahId'],
      _min: { page: true },
    }),
  ]);

  const startPageById = new Map<number, number | null>();
  for (const row of firstPages) {
    if (row.surahId != null) startPageById.set(row.surahId, row._min.page ?? null);
  }

  return surahs.map((s) => ({
    id: s.id,
    nameAr: s.nameAr,
    nameEn: s.nameEn,
    revelationType: s.revelationType,
    totalAyahs: s.totalAyahs,
    totalPages: s.totalPages,
    startPage: startPageById.get(s.id) ?? 1,
  }));
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
      revelationType: true,
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
    items: sanitizeAyahList(items),
    meta: buildPaginationMeta(pagination.page, pagination.limit, total),
  };
}

export async function listBookmarks(userId: string) {
  try {
    await ensureSurahCatalog();
    const bookmarks = await prisma.quranBookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        surahId: true,
        ayahNumber: true,
        page: true,
        note: true,
        createdAt: true,
      },
    });

    if (bookmarks.length === 0) return [];

    const surahIds = [...new Set(bookmarks.map((b) => b.surahId))];
    const surahRows = await prisma.surah.findMany({
      where: { id: { in: surahIds } },
      select: { id: true, nameEn: true, nameAr: true },
    });
    const surahById = new Map(surahRows.map((s) => [s.id, s] as const));

    const ayahKeys = bookmarks
      .filter((b) => b.ayahNumber != null)
      .map((b) => ({ surahId: b.surahId, ayahNumber: b.ayahNumber as number }));

    const ayahMap = new Map<string, string>();
    if (ayahKeys.length > 0) {
      const ayahRows = await prisma.ayah.findMany({
        where: { OR: ayahKeys.map((k) => ({ surahId: k.surahId, ayahNumber: k.ayahNumber })) },
        select: { surahId: true, ayahNumber: true, textAr: true },
      });
      for (const a of ayahRows) {
        ayahMap.set(
          `${a.surahId}:${a.ayahNumber}`,
          stripSurahOpeningBismillahIfNeeded(a),
        );
      }
    }

    return bookmarks.map((b) => {
      const surahObj = surahById.get(b.surahId) ?? {
        id: b.surahId,
        nameEn: 'Unknown',
        nameAr: 'غير معروف',
      };
      return {
        id: b.id,
        userId,
        surahId: b.surahId,
        ayahNumber: b.ayahNumber,
        page: b.page,
        note: b.note,
        textAr:
          b.ayahNumber != null ? ayahMap.get(`${b.surahId}:${b.ayahNumber}`) ?? null : null,
        surahNameAr: surahObj.nameAr,
        surah: surahObj,
        createdAt: b.createdAt.toISOString(),
      };
    });
  } catch {
    return [];
  }
}

export async function createBookmark(userId: string, surahId: number, ayahNumber?: number, note?: string, page?: number) {
  await ensureSurahCatalog();
  const surah = await prisma.surah.findUnique({ where: { id: surahId } });

  if (!surah) {
    throw new AppError('Surah not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  if (ayahNumber != null && (ayahNumber < 1 || ayahNumber > surah.totalAyahs)) {
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

  const where: any = { userId, surahId };
  if (ayahNumber != null) where.ayahNumber = ayahNumber;
  if (page != null) where.page = page;
  const existing = await prisma.quranBookmark.findFirst({ where });
  if (existing) {
    throw new AppError('This ayah/page is already bookmarked', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
  }

  const created = await prisma.quranBookmark.create({
    data: { userId, surahId, ayahNumber: ayahNumber ?? null, page: page ?? null, note },
    include: {
      surah: {
        select: { id: true, nameEn: true, nameAr: true },
      },
    },
  });
  let textAr: string | null = null;
  if (ayahNumber != null) {
    const ayah = await prisma.ayah.findFirst({
      where: { surahId, ayahNumber },
      select: { textAr: true },
    });
    textAr = ayah?.textAr ?? null;
  }
  return serializeBookmark({ ...created, userId, surah: created.surah }, textAr);
}

export async function updateBookmark(userId: string, bookmarkId: string, note: string) {
  const row = await prisma.quranBookmark.findUnique({ where: { id: bookmarkId } });
  if (!row || row.userId !== userId) {
    throw new AppError('Bookmark not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }
  const updated = await prisma.quranBookmark.update({
    where: { id: bookmarkId },
    data: { note },
    include: {
      surah: { select: { id: true, nameEn: true, nameAr: true } },
    },
  });
  let textAr: string | null = null;
  if (updated.surahId != null && updated.ayahNumber != null) {
    const ayah = await prisma.ayah.findFirst({
      where: { surahId: updated.surahId, ayahNumber: updated.ayahNumber },
      select: { textAr: true },
    });
    textAr = ayah?.textAr ?? null;
  }
  return serializeBookmark({ ...updated, userId }, textAr);
}

export async function resetKhatmah(userId: string) {
  await ensureSurahCatalog();
  try {
    await prisma.khatmah.updateMany({
      where: { userId },
      data: {
        currentSurahId: 2,
        currentPage: 1,
        totalPagesRead: 0,
      },
    });
    const khatmah = await prisma.khatmah.upsert({
      where: { userId },
      create: { userId, currentSurahId: 2, currentPage: 1 },
      update: {},
    });
    const surah = await prisma.surah.findUnique({ where: { id: khatmah.currentSurahId } });
    return formatKhatmah(khatmah, surah, { reset: true });
  } catch {
    return { ...FALLBACK_KHATMAH, reset: true };
  }
}

export async function searchQuran(query: string, page = 1, limit = 20) {
  if (!query || query.trim().length === 0) {
    throw new AppError('Search query is required (min 1 char)', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.ayah.findMany({
      where: { textAr: { contains: query.trim(), mode: 'insensitive' } },
      orderBy: [{ surahId: 'asc' }, { ayahNumber: 'asc' }],
      take: limit,
      skip,
      select: {
        id: true,
        surahId: true,
        ayahNumber: true,
        textAr: true,
        page: true,
        juz: true,
      },
    }),
    prisma.ayah.count({
      where: { textAr: { contains: query.trim(), mode: 'insensitive' } },
    }),
  ]);
  const surahIds = Array.from(new Set(items.map((a) => a.surahId)));
  const surahs = await prisma.surah.findMany({
    where: { id: { in: surahIds } },
    select: { id: true, nameAr: true, nameEn: true, revelationType: true },
  });
  const byId = new Map(surahs.map((s) => [s.id, s] as const));
  const enriched = sanitizeAyahList(items).map((a) => ({
    ...a,
    surah: byId.get(a.surahId) ?? null,
  }));
  return {
    query: query.trim(),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    results: enriched,
  };
}

export async function getRandomAyah() {
  const total = await prisma.ayah.count();
  const idx = Math.floor(Math.random() * total);
  const raw = await prisma.ayah.findFirst({
    skip: idx,
    take: 1,
    select: { id: true, surahId: true, ayahNumber: true, textAr: true, page: true, juz: true },
  });
  if (!raw) throw new AppError('No ayahs found (seed DB first)', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  const ayah = sanitizeAyahText(raw);
  const surah = await prisma.surah.findUnique({
    where: { id: ayah.surahId },
    select: { id: true, nameAr: true, nameEn: true, totalAyahs: true, revelationType: true },
  });
  return { ayah, surah };
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
  try {
    await ensureSurahCatalog();
    const row = await prisma.quranLastRead.findUnique({
      where: { userId },
      include: {
        surah: {
          select: { id: true, nameEn: true, nameAr: true },
        },
      },
    });

    if (!row) return null;

    let juz: number | null = null;
    if (row.surahId != null && row.ayahNumber != null) {
      try {
        const ayahRow = await prisma.ayah.findFirst({
          where: { surahId: row.surahId, ayahNumber: row.ayahNumber },
          select: { juz: true },
        });
        juz = ayahRow?.juz ?? null;
      } catch { /* */ }
    }

    const surahObj = row.surah ?? { id: row.surahId, nameEn: 'Unknown', nameAr: 'غير معروف' };
    return {
      surahId: row.surahId,
      page: row.page,
      ayahNumber: row.ayahNumber,
      juz,
      surahNameAr: surahObj.nameAr,
      surah: {
        id: surahObj.id,
        nameAr: surahObj.nameAr,
        nameEn: surahObj.nameEn,
      },
    };
  } catch {
    return null;
  }
}

export async function updateLastRead(userId: string, surahId: number, ayahNumber: number, page?: number) {
  await ensureSurahCatalog();
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

  const saved = await prisma.quranLastRead.upsert({
    where: { userId },
    create: { userId, surahId, ayahNumber, page },
    update: { surahId, ayahNumber, page },
    include: {
      surah: {
        select: { id: true, nameEn: true, nameAr: true },
      },
    },
  });

  let juz: number | null = null;
  try {
    const ayahRow = await prisma.ayah.findFirst({
      where: { surahId, ayahNumber },
      select: { juz: true },
    });
    juz = ayahRow?.juz ?? null;
  } catch { /* */ }

  const surahObj = saved.surah ?? { id: surahId, nameEn: surah.nameEn, nameAr: surah.nameAr };
  return {
    surahId: saved.surahId,
    page: saved.page,
    ayahNumber: saved.ayahNumber,
    juz,
    surahNameAr: surahObj.nameAr,
    surah: {
      id: surahObj.id,
      nameAr: surahObj.nameAr,
      nameEn: surahObj.nameEn,
    },
  };
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
  await ensureSurahCatalog();
  try {
    const khatmah = await prisma.khatmah.upsert({
      where: { userId },
      create: { userId, currentSurahId: 2, currentPage: 1 },
      update: {},
    });
    const surah = await prisma.surah.findUnique({ where: { id: khatmah.currentSurahId } });
    return formatKhatmah(khatmah, surah);
  } catch {
    return { ...FALLBACK_KHATMAH };
  }
}

export async function updateKhatmah(userId: string, surahId: number, page: number, pagesRead = 1) {
  if (surahId < 1 || page < 1 || pagesRead < 1) {
    throw new AppError(
      'Invalid khatmah progress',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  await ensureSurahCatalog();

  const nextPage = Math.min(page, TOTAL_QURAN_PAGES);
  const nextSurahId = surahId;

  const surahExists = await prisma.surah.findUnique({
    where: { id: nextSurahId },
    select: { id: true, nameEn: true, nameAr: true },
  });
  if (!surahExists) {
    throw new AppError('Surah not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  try {
    const khatmah = await prisma.khatmah.upsert({
      where: { userId },
      create: {
        userId,
        currentSurahId: nextSurahId,
        currentPage: nextPage,
        totalPagesRead: pagesRead,
      },
      update: {
        currentSurahId: nextSurahId,
        currentPage: nextPage,
        totalPagesRead: { increment: pagesRead },
      },
    });
    return formatKhatmah(khatmah, surahExists);
  } catch {
    return formatKhatmah(
      {
        currentSurahId: nextSurahId,
        currentPage: nextPage,
        totalPagesRead: pagesRead,
      },
      surahExists,
    );
  }
}

// ============================================================
//  NEW: Juz (الأجزاء), Quran page reader, Khatmah stats
// ============================================================

const JUZ_ARABIC_NAMES = [
  'الجزء الأول', 'الجزء الثاني', 'الجزء الثالث', 'الجزء الرابع', 'الجزء الخامس',
  'الجزء السادس', 'الجزء السابع', 'الجزء الثامن', 'الجزء التاسع', 'الجزء العاشر',
  'الجزء الحادي عشر', 'الجزء الثاني عشر', 'الجزء الثالث عشر', 'الجزء الرابع عشر', 'الجزء الخامس عشر',
  'الجزء السادس عشر', 'الجزء السابع عشر', 'الجزء الثامن عشر', 'الجزء التاسع عشر', 'الجزء العشرون',
  'الجزء الحادي والعشرون', 'الجزء الثاني والعشرون', 'الجزء الثالث والعشرون', 'الجزء الرابع والعشرون', 'الجزء الخامس والعشرون',
  'الجزء السادس والعشرون', 'الجزء السابع والعشرون', 'الجزء الثامن والعشرون', 'الجزء التاسع والعشرون', 'الجزء الثلاثون',
];

const JUZ_ENGLISH_NAMES = [
  "Juz' 1", "Juz' 2", "Juz' 3", "Juz' 4", "Juz' 5",
  "Juz' 6", "Juz' 7", "Juz' 8", "Juz' 9", "Juz' 10",
  "Juz' 11", "Juz' 12", "Juz' 13", "Juz' 14", "Juz' 15",
  "Juz' 16", "Juz' 17", "Juz' 18", "Juz' 19", "Juz' 20",
  "Juz' 21", "Juz' 22", "Juz' 23", "Juz' 24", "Juz' 25",
  "Juz' 26", "Juz' 27", "Juz' 28", "Juz' 29", "Juz' 30",
];

const DAILY_QURAN_PAGES_TARGET = 5;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function listJuz() {
  const ayahGroups = await prisma.ayah.groupBy({
    by: ['juz'],
    _min: { page: true, ayahNumber: true, surahId: true },
    _max: { page: true, ayahNumber: true, surahId: true },
    _count: { _all: true },
    where: { juz: { not: null } },
  });

  const byJuz = new Map<number, typeof ayahGroups[number]>();
  const firstSurahIds = new Set<number>();
  for (const g of ayahGroups) {
    if (g.juz != null) {
      byJuz.set(g.juz, g);
      if (g._min.surahId != null) firstSurahIds.add(g._min.surahId);
    }
  }

  const surahRows = await prisma.surah.findMany({
    where: { id: { in: Array.from(firstSurahIds) } },
    select: { id: true, nameAr: true, nameEn: true },
  });
  const surahById = new Map(surahRows.map((s) => [s.id, s] as const));

  const result = [];
  for (let i = 1; i <= 30; i++) {
    const g = byJuz.get(i);
    const firstSurah = g?._min.surahId ? surahById.get(g._min.surahId) ?? null : null;
    result.push({
      juzNumber: i,
      nameAr: JUZ_ARABIC_NAMES[i - 1],
      nameEn: JUZ_ENGLISH_NAMES[i - 1],
      totalAyahs: g?._count?._all ?? 0,
      startPage: g?._min.page ?? null,
      endPage: g?._max.page ?? null,
      firstSurah: firstSurah ?? { id: 1, nameEn: 'Al-Fatihah', nameAr: 'الفاتحة' },
    });
  }
  return result;
}

export async function listJuzSurahs(juzNumber: number) {
  if (juzNumber < 1 || juzNumber > 30) {
    throw new AppError('Invalid juz number (1..30)', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  const surahIds = await prisma.ayah.findMany({
    where: { juz: juzNumber },
    distinct: ['surahId'],
    select: { surahId: true },
    orderBy: { surahId: 'asc' },
  });
  const rows = await Promise.all(
    surahIds.map(async ({ surahId }) => {
      const [surah, first, last, count] = await Promise.all([
        prisma.surah.findUnique({
          where: { id: surahId },
          select: { id: true, nameEn: true, nameAr: true, totalAyahs: true, totalPages: true, revelationType: true },
        }),
        prisma.ayah.findFirst({ where: { juz: juzNumber, surahId }, orderBy: { ayahNumber: 'asc' }, select: { ayahNumber: true, page: true } }),
        prisma.ayah.findFirst({ where: { juz: juzNumber, surahId }, orderBy: { ayahNumber: 'desc' }, select: { ayahNumber: true, page: true } }),
        prisma.ayah.count({ where: { juz: juzNumber, surahId } }),
      ]);
      return {
        ...surah,
        fromAyah: first?.ayahNumber ?? 1,
        toAyah: last?.ayahNumber ?? 1,
        startPage: first?.page ?? null,
        endPage: last?.page ?? null,
        ayahsInJuz: count,
      };
    }),
  );
  return { juzNumber, nameAr: JUZ_ARABIC_NAMES[juzNumber - 1], nameEn: JUZ_ENGLISH_NAMES[juzNumber - 1], surahs: rows };
}

export async function listAyahsByPage(pageNumber: number) {
  if (pageNumber < 1 || pageNumber > TOTAL_QURAN_PAGES) {
    throw new AppError(
      `Invalid Mushaf page number (1..${TOTAL_QURAN_PAGES})`,
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }
  const raw = await prisma.ayah.findMany({
    where: { page: pageNumber },
    orderBy: [{ surahId: 'asc' }, { ayahNumber: 'asc' }],
    select: {
      id: true, surahId: true, ayahNumber: true, textAr: true, page: true, juz: true,
    },
  });
  const ayahs = sanitizeAyahList(raw);
  const surahIds = Array.from(new Set(ayahs.map((a) => a.surahId)));
  const surahs = await prisma.surah.findMany({
    where: { id: { in: surahIds } },
    select: { id: true, nameAr: true, nameEn: true, revelationType: true },
  });
  return { page: pageNumber, totalPages: TOTAL_QURAN_PAGES, ayahs, surahs };
}

async function getReadingStreakDays(userId: string): Promise<number> {
  const rows = await prisma.dailyProgress.findMany({
    where: { userId, quranPagesRead: { gt: 0 } },
    select: { date: true },
    orderBy: { date: 'desc' },
    take: 365,
  });
  if (rows.length === 0) return 0;
  const uniqueDates = new Set(rows.map((r) => startOfDay(r.date).toDateString()));
  let streak = 0;
  const cursor = startOfDay(new Date());
  while (uniqueDates.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

async function getPagesReadToday(userId: string): Promise<number> {
  const row = await prisma.dailyProgress.findUnique({
    where: { userId_date: { userId, date: getTodayDateOnly() } },
    select: { quranPagesRead: true },
  });
  return row?.quranPagesRead ?? 0;
}

export async function getKhatmahWithStats(userId: string) {
  const base = await getKhatmah(userId);
  const [streakDays, pagesReadToday] = await Promise.all([
    getReadingStreakDays(userId),
    getPagesReadToday(userId),
  ]);
  const completedKhatmahCount = Math.floor((base.totalPagesRead ?? 0) / TOTAL_QURAN_PAGES);
  return {
    ...base,
    dailyGoal: {
      pagesTarget: DAILY_QURAN_PAGES_TARGET,
      pagesReadToday,
      completed: pagesReadToday >= DAILY_QURAN_PAGES_TARGET,
      remainingToday: Math.max(0, DAILY_QURAN_PAGES_TARGET - pagesReadToday),
    },
    stats: {
      streakDays,
      completedKhatmahCount,
      totalPagesRead: base.totalPagesRead,
    },
  };
}

// ============================================================
//  NEW: Offline Catalog — Full Quran + Juz Ayahs for download
// ============================================================

export type CatalogSurahAyah = {
  ayahNumber: number;
  textAr: string;
  page: number | null;
  juz: number | null;
};

export type CatalogSurah = {
  id: number;
  nameAr: string;
  nameEn: string;
  revelationType: 'MAKKI' | 'MADANI' | null;
  totalAyahs: number;
  ayahs: CatalogSurahAyah[];
};

export type FullQuranCatalog = {
  meta: {
    catalogVersion: number;
    totalSurahs: number;
    totalAyahs: number;
    totalPages: number;
    totalJuz: number;
    bismillahStripped: boolean;
  };
  surahs: CatalogSurah[];
};

export async function getFullQuranCatalog(): Promise<FullQuranCatalog> {
  const surahRows = await prisma.surah.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      totalAyahs: true,
      revelationType: true,
    },
  });

  const ayahRows = await prisma.ayah.findMany({
    orderBy: [{ surahId: 'asc' }, { ayahNumber: 'asc' }],
    select: {
      surahId: true,
      ayahNumber: true,
      textAr: true,
      page: true,
      juz: true,
    },
  });

  const sanitizedAyahs = sanitizeAyahList(ayahRows);
  const bySurah = new Map<number, CatalogSurahAyah[]>();
  let totalAyahs = 0;

  for (const a of sanitizedAyahs) {
    const arr = bySurah.get(a.surahId) ?? [];
    arr.push({
      ayahNumber: a.ayahNumber,
      textAr: a.textAr,
      page: a.page ?? null,
      juz: a.juz ?? null,
    });
    bySurah.set(a.surahId, arr);
    totalAyahs += 1;
  }

  const surahs: CatalogSurah[] = surahRows.map((s) => ({
    id: s.id,
    nameAr: s.nameAr,
    nameEn: s.nameEn,
    revelationType: (s.revelationType as 'MAKKI' | 'MADANI') ?? null,
    totalAyahs: s.totalAyahs,
    ayahs: bySurah.get(s.id) ?? [],
  }));

  return {
    meta: {
      catalogVersion: 1,
      totalSurahs: surahs.length,
      totalAyahs,
      totalPages: TOTAL_QURAN_PAGES,
      totalJuz: 30,
      bismillahStripped: true,
    },
    surahs,
  };
}

export async function listAyahsByJuz(juzNumber: number) {
  if (juzNumber < 1 || juzNumber > 30) {
    throw new AppError('Invalid juz number (1..30)', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  const raw = await prisma.ayah.findMany({
    where: { juz: juzNumber },
    orderBy: [{ surahId: 'asc' }, { ayahNumber: 'asc' }],
    select: {
      id: true,
      surahId: true,
      ayahNumber: true,
      textAr: true,
      page: true,
      juz: true,
    },
  });
  const ayahs = sanitizeAyahList(raw);
  const surahIds = Array.from(new Set(ayahs.map((a) => a.surahId)));
  const surahs = await prisma.surah.findMany({
    where: { id: { in: surahIds } },
    select: { id: true, nameAr: true, nameEn: true, revelationType: true },
  });
  return {
    juzNumber,
    nameAr: JUZ_ARABIC_NAMES[juzNumber - 1],
    nameEn: JUZ_ENGLISH_NAMES[juzNumber - 1],
    totalAyahs: ayahs.length,
    ayahs,
    surahs,
  };
}


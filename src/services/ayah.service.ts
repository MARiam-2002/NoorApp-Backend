import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import {
  resolveSurahNameAr,
  resolveSurahNameEn,
  withResolvedSurahNames,
} from '../lib/surah-names';
import { parsePaginationQuery, buildPaginationMeta } from '../utils/pagination';
import { getTodayDateOnly } from '../utils/date';

const TOTAL_AYAHS = 6236;

function stripBom(text: string): string {
  if (text && text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

const BISMILLAH_REGEX = /^(?:\uFEFF)?ب[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*س[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*م[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*[\s\u200C-\u200F\u202A-\u202E\u00A0]+[\u0671\u0627]?ل[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ل[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ه[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*[\s\u200C-\u200F\u202A-\u202E\u00A0]+[\u0671\u0627]?ل[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ر[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ح[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*م[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*[\u0622\u0623\u0625\u0627\u0671]?ن[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ي?[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*[\s\u200C-\u200F\u202A-\u202E\u00A0]+[\u0671\u0627]?ل[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ر[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ح[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ي[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*م[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*(?:[\s\u200C-\u200F\u202A-\u202E\u00A0]+|$)/u;

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

type AyahWithSurah = {
  id: string;
  surahId: number;
  ayahNumber: number;
  textAr: string;
  page: number | null;
  juz: number | null;
  surah: {
    id: number;
    nameAr: string;
    nameEn: string;
    revelationType?: string | null;
  };
};

function serializeAyahPayload(ayah: AyahWithSurah, extra?: Record<string, unknown>) {
  const sanitized = sanitizeAyahText(ayah);
  const surah = withResolvedSurahNames({
    id: ayah.surah.id,
    nameAr: ayah.surah.nameAr,
    nameEn: ayah.surah.nameEn,
    ...(ayah.surah.revelationType ? { revelationType: ayah.surah.revelationType } : {}),
  });
  return {
    id: sanitized.id,
    surahId: sanitized.surahId,
    ayahNumber: sanitized.ayahNumber,
    textAr: sanitized.textAr,
    page: sanitized.page,
    juz: sanitized.juz,
    surahNameAr: resolveSurahNameAr(surah.id, surah.nameAr),
    surahNameEn: resolveSurahNameEn(surah.id, surah.nameEn),
    surah,
    ...(extra ?? {}),
  };
}

async function pickRandomAyah(excludeKey?: { surahId: number; ayahNumber: number }): Promise<{
  id: string;
  surahId: number;
  ayahNumber: number;
  textAr: string;
  page: number | null;
  juz: number | null;
}> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const idx = Math.floor(Math.random() * TOTAL_AYAHS);
    const raw = await prisma.ayah.findFirst({
      skip: idx,
      take: 1,
      select: {
        id: true,
        surahId: true,
        ayahNumber: true,
        textAr: true,
        page: true,
        juz: true,
      },
    });
    if (!raw) continue;
    if (
      excludeKey &&
      raw.surahId === excludeKey.surahId &&
      raw.ayahNumber === excludeKey.ayahNumber
    ) {
      continue;
    }
    return raw;
  }
  const total = await prisma.ayah.count();
  const safeTotal = total || TOTAL_AYAHS;
  const idx = Math.floor(Math.random() * safeTotal);
  const raw = await prisma.ayah.findFirst({
    skip: idx,
    take: 1,
    select: {
      id: true,
      surahId: true,
      ayahNumber: true,
      textAr: true,
      page: true,
      juz: true,
    },
  });
  if (!raw) {
    throw new AppError(
      'No ayahs found (seed DB first)',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }
  return raw;
}

export async function getUserAyah(userId: string, sessionId: string) {
  const today = getTodayDateOnly();

  const existing = await prisma.userAyahHistory.findUnique({
    where: { userId_sessionId: { userId, sessionId } },
    select: {
      id: true,
      surahId: true,
      ayahNumber: true,
      displayDate: true,
      createdAt: true,
    },
  });

  let surahId: number;
  let ayahNumber: number;
  let historyId: string;
  let isNew = false;

  if (existing) {
    surahId = existing.surahId;
    ayahNumber = existing.ayahNumber;
    historyId = existing.id;
  } else {
    isNew = true;
    const lastPrevious = await prisma.userAyahHistory.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { surahId: true, ayahNumber: true },
    });
    const exclude = lastPrevious
      ? { surahId: lastPrevious.surahId, ayahNumber: lastPrevious.ayahNumber }
      : undefined;

    const picked = await pickRandomAyah(exclude);
    surahId = picked.surahId;
    ayahNumber = picked.ayahNumber;

    const created = await prisma.userAyahHistory.upsert({
      where: { userId_sessionId: { userId, sessionId } },
      create: {
        userId,
        sessionId,
        surahId,
        ayahNumber,
        displayDate: today,
      },
      update: {},
      select: { id: true, createdAt: true },
    });
    historyId = created.id;
  }

  const raw = await prisma.ayah.findUnique({
    where: { surahId_ayahNumber: { surahId, ayahNumber } },
    include: {
      surah: {
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          revelationType: true,
        },
      },
    },
  });

  if (!raw) {
    throw new AppError(
      'Ayah reference not found in Quran source of truth',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  const serialized = serializeAyahPayload(raw as unknown as AyahWithSurah, {
    historyId,
    displayDate: today.toISOString().slice(0, 10),
    sessionId,
    isNew,
  });

  return serialized;
}

export async function getUserAyahHistory(
  userId: string,
  page?: number | string,
  limit?: number | string,
) {
  const pagination = parsePaginationQuery(page, limit);

  const [rows, total] = await Promise.all([
    prisma.userAyahHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      select: {
        id: true,
        surahId: true,
        ayahNumber: true,
        displayDate: true,
        createdAt: true,
      },
    }),
    prisma.userAyahHistory.count({ where: { userId } }),
  ]);

  if (rows.length === 0) {
    return {
      items: [],
      meta: buildPaginationMeta(pagination.page, pagination.limit, total),
    };
  }

  const surahIds = Array.from(new Set(rows.map((r) => r.surahId)));
  const surahRows = await prisma.surah.findMany({
    where: { id: { in: surahIds } },
    select: { id: true, nameAr: true, nameEn: true, revelationType: true },
  });
  const surahById = new Map(surahRows.map((s) => [s.id, s] as const));

  const ayahKeys = rows.map((r) => ({ surahId: r.surahId, ayahNumber: r.ayahNumber }));
  const ayahRows = await prisma.ayah.findMany({
    where: {
      OR: ayahKeys.map((k) => ({ surahId: k.surahId, ayahNumber: k.ayahNumber })),
    },
    select: {
      id: true,
      surahId: true,
      ayahNumber: true,
      textAr: true,
      page: true,
      juz: true,
    },
  });
  const ayahByKey = new Map(
    ayahRows.map((a) => [`${a.surahId}:${a.ayahNumber}`, a] as const),
  );

  const items = rows.map((row) => {
    const ayah = ayahByKey.get(`${row.surahId}:${row.ayahNumber}`);
    const surah = surahById.get(row.surahId);
    const baseSurah = surah ?? {
      id: row.surahId,
      nameAr: 'غير معروف',
      nameEn: 'Unknown',
      revelationType: null,
    };
    const baseAyah = ayah ?? {
      id: `ref-${row.surahId}-${row.ayahNumber}`,
      surahId: row.surahId,
      ayahNumber: row.ayahNumber,
      textAr: '',
      page: null,
      juz: null,
    };
    return serializeAyahPayload(
      {
        ...baseAyah,
        surah: baseSurah,
      } as unknown as AyahWithSurah,
      {
        historyId: row.id,
        displayDate: row.displayDate.toISOString().slice(0, 10),
        createdAt: row.createdAt.toISOString(),
      },
    );
  });

  return {
    items,
    meta: buildPaginationMeta(pagination.page, pagination.limit, total),
  };
}

import { getUserLocalCalendarDay } from '../shared/utils/user-local-date';
import type { TasbihDhikr } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';

export enum Dhikr {
  SUBHAN_ALLAH = 'SUBHAN_ALLAH',
  ALHAMDULILLAH = 'ALHAMDULILLAH',
  LA_ILAHA_ILLA_ALLAH = 'LA_ILAHA_ILLA_ALLAH',
  ALLAHU_AKBAR = 'ALLAHU_AKBAR',
  ASTAGHFIRULLAH = 'ASTAGHFIRULLAH',
  LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH = 'LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH',
  /** Sahih al-Bukhari 6405 / Sahih Muslim — 100× daily */
  SUBHAN_ALLAHI_WA_BIHAMDIHI = 'SUBHAN_ALLAHI_WA_BIHAMDIHI',
  /** Completes 100 after 33×3 (Muslim 597a); also 100× daily (Bukhari/Muslim) */
  LA_ILAHA_ILLA_ALLAH_WAHDAHU = 'LA_ILAHA_ILLA_ALLAH_WAHDAHU',
  /** Sahih al-Bukhari 6406 — two words light on the tongue; no fixed count */
  SUBHAN_ALLAHI_WA_BIHAMDIHI_SUBHAN_ALLAHI_L_AZIM = 'SUBHAN_ALLAHI_WA_BIHAMDIHI_SUBHAN_ALLAHI_L_AZIM',
}

const dhikrArNamesMap: Record<Dhikr, string> = {
  [Dhikr.SUBHAN_ALLAH]: 'سبحان الله',
  [Dhikr.ALHAMDULILLAH]: 'الحمد لله',
  [Dhikr.LA_ILAHA_ILLA_ALLAH]: 'لا إله إلا الله',
  [Dhikr.ALLAHU_AKBAR]: 'الله أكبر',
  [Dhikr.ASTAGHFIRULLAH]: 'أستغفر الله',
  [Dhikr.LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH]: 'لا حول ولا قوة إلا بالله',
  [Dhikr.SUBHAN_ALLAHI_WA_BIHAMDIHI]: 'سبحان الله وبحمده',
  [Dhikr.LA_ILAHA_ILLA_ALLAH_WAHDAHU]:
    'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد، وهو على كل شيء قدير',
  [Dhikr.SUBHAN_ALLAHI_WA_BIHAMDIHI_SUBHAN_ALLAHI_L_AZIM]:
    'سبحان الله وبحمده، سبحان الله العظيم',
};

const dhikrEnNamesMap: Record<Dhikr, string> = {
  [Dhikr.SUBHAN_ALLAH]: 'Glory be to Allah',
  [Dhikr.ALHAMDULILLAH]: 'All praise is due to Allah',
  [Dhikr.LA_ILAHA_ILLA_ALLAH]: 'There is no god but Allah',
  [Dhikr.ALLAHU_AKBAR]: 'Allah is the Greatest',
  [Dhikr.ASTAGHFIRULLAH]: 'I seek forgiveness from Allah',
  [Dhikr.LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH]: 'There is no power nor strength except through Allah',
  [Dhikr.SUBHAN_ALLAHI_WA_BIHAMDIHI]: 'Glory be to Allah and praise be to Him',
  [Dhikr.LA_ILAHA_ILLA_ALLAH_WAHDAHU]:
    'There is no god but Allah alone, with no partner. His is the dominion and His is the praise, and He is Able to do all things',
  [Dhikr.SUBHAN_ALLAHI_WA_BIHAMDIHI_SUBHAN_ALLAHI_L_AZIM]:
    'Glory be to Allah and praise be to Him; Glory be to Allah the Magnificent',
};

export function getDhikrArName(dhikr: string): string {
  const key = dhikr as Dhikr;
  return dhikrArNamesMap[key] ?? dhikr;
}

export function getDhikrEnName(dhikr: string): string {
  const key = dhikr as Dhikr;
  return dhikrEnNamesMap[key] ?? dhikr;
}

export type DhikrOption = {
  id: Dhikr;
  dhikrAr: string;
  dhikrEn: string;
};

export function listDhikrOptions(): DhikrOption[] {
  return (Object.keys(Dhikr) as Dhikr[]).map((key) => ({
    id: key,
    dhikrAr: dhikrArNamesMap[key],
    dhikrEn: dhikrEnNamesMap[key],
  }));
}

/**
 * Catalog for GET /tasbihs — ordered picker list for Flutter.
 *
 * Sources (Sahih only for fixed counts):
 * - Muslim 597a: after every prayer — سبحان الله / الحمد لله / الله أكبر ×33,
 *   then completes 100 with the long tahlil (once).
 * - Bukhari 6405 / Muslim: سبحان الله وبحمده ×100 in a day (and morning/evening).
 * - Bukhari/Muslim: long tahlil ×100 in a day.
 * - Bukhari 6406: سبحان الله وبحمده، سبحان الله العظيم (virtue; no fixed count).
 * - Bukhari / Muslim: لا حول ولا قوة إلا بالله (treasure of Paradise; no fixed count).
 *
 * `count` is set only when a single fixed repetition is established in Sahih;
 * otherwise null. Texts 1–6 match the Flutter "اختر الذكر" sheet.
 */
export type TasbihCatalogItem = {
  id: Dhikr;
  order: number;
  text: string;
  count: number | null;
};

/** After-salah tasbih (Sahih Muslim 597a). */
const AFTER_SALAH_COUNT = 33;
/** Daily count in Sahih for سبحان الله وبحمده and the long tahlil. */
const DAILY_HUNDRED_COUNT = 100;

const TASBIH_CATALOG: ReadonlyArray<Omit<TasbihCatalogItem, 'order'>> = [
  { id: Dhikr.SUBHAN_ALLAH, text: 'سبحان الله', count: AFTER_SALAH_COUNT },
  { id: Dhikr.ALHAMDULILLAH, text: 'الحمد لله', count: AFTER_SALAH_COUNT },
  { id: Dhikr.LA_ILAHA_ILLA_ALLAH, text: 'لا إله إلا الله', count: null },
  { id: Dhikr.ALLAHU_AKBAR, text: 'الله أكبر', count: AFTER_SALAH_COUNT },
  { id: Dhikr.ASTAGHFIRULLAH, text: 'أستغفر الله', count: null },
  {
    id: Dhikr.LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH,
    text: 'لا حول ولا قوة إلا بالله',
    count: null,
  },
  {
    id: Dhikr.SUBHAN_ALLAHI_WA_BIHAMDIHI,
    text: 'سبحان الله وبحمده',
    count: DAILY_HUNDRED_COUNT,
  },
  {
    id: Dhikr.LA_ILAHA_ILLA_ALLAH_WAHDAHU,
    text: 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد، وهو على كل شيء قدير',
    count: DAILY_HUNDRED_COUNT,
  },
  {
    id: Dhikr.SUBHAN_ALLAHI_WA_BIHAMDIHI_SUBHAN_ALLAHI_L_AZIM,
    text: 'سبحان الله وبحمده، سبحان الله العظيم',
    count: null,
  },
];

export function listTasbihs(): TasbihCatalogItem[] {
  return TASBIH_CATALOG.map((item, index) => ({
    ...item,
    order: index + 1,
  }));
}

/**
 * Public catalog, plus the authenticated user's own customs when `userId` is set.
 * Never includes other users' customs. Response stays a flat array.
 */
export async function listTasbihsForViewer(userId?: string | null) {
  const catalog = listTasbihs();
  if (!userId) return catalog;

  const customs = await listUserTasbihs(userId);
  const base = catalog.length;
  return [
    ...catalog,
    ...customs.map((item) => ({
      ...item,
      order: base + item.order,
    })),
  ];
}

export type UserTasbihItem = {
  id: string;
  order: number;
  text: string;
  count: number | null;
  isCustom: true;
};

function normalizeTasbihText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function toUserTasbihItem(row: {
  id: string;
  text: string;
  count: number | null;
  sortOrder: number;
}): UserTasbihItem {
  return {
    id: row.id,
    order: row.sortOrder,
    text: row.text,
    count: row.count,
    isCustom: true,
  };
}

/** Personal custom list for the logged-in user only. */
export async function listUserTasbihs(userId: string): Promise<UserTasbihItem[]> {
  const rows = await prisma.userTasbih.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toUserTasbihItem);
}

export async function addUserTasbih(
  userId: string,
  input: { text: string; count?: number | null },
): Promise<UserTasbihItem> {
  const text = normalizeTasbihText(input.text);
  if (!text) {
    throw new AppError('Tasbih text is required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  if (text.length > 500) {
    throw new AppError(
      'Tasbih text must be at most 500 characters',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  let count: number | null = null;
  if (input.count !== undefined && input.count !== null) {
    if (!Number.isInteger(input.count) || input.count < 1 || input.count > 100_000) {
      throw new AppError(
        'count must be a positive integer (or null)',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
    count = input.count;
  }

  const existing = await prisma.userTasbih.findUnique({
    where: { userId_text: { userId, text } },
  });
  if (existing) {
    throw new AppError(
      'This tasbih is already in your personal list',
      HttpStatus.CONFLICT,
      ErrorCodes.CONFLICT,
    );
  }

  const maxOrder = await prisma.userTasbih.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? 0) + 1;

  const row = await prisma.userTasbih.create({
    data: { userId, text, count, sortOrder },
  });
  return toUserTasbihItem(row);
}

export async function removeUserTasbih(userId: string, tasbihId: string): Promise<{ removed: boolean }> {
  const existing = await prisma.userTasbih.findFirst({
    where: { id: tasbihId, userId },
  });
  if (!existing) {
    throw new AppError(
      'Custom tasbih not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }
  await prisma.userTasbih.delete({ where: { id: existing.id } });
  return { removed: true };
}

const TASBIH_DAILY_GOAL = 99;

export type ContractTasbih = {
  count: number;
  dhikr: string;
  dhikrAr: string;
  dhikrEn: string;
  dailyGoal: number;
  progressPercent: number;
  todayCount?: number;
  currentDhikr?: string;
  currentDhikrAr?: string;
  currentDhikrEn?: string;
  currentDhikrCount?: number;
  id?: string;
  date?: Date;
  totalAllTime?: number;
};

function toContractTasbih(log: {
  id: string;
  date?: Date;
  dhikr: TasbihDhikr | string;
  count: number;
  totalAllTime?: number;
}): ContractTasbih {
  const dhikrKey = (log.dhikr ?? Dhikr.SUBHAN_ALLAH) as string;
  const dhikrAr = getDhikrArName(dhikrKey);
  const dhikrEn = getDhikrEnName(dhikrKey);
  const progressPercent = TASBIH_DAILY_GOAL > 0
    ? Math.min(100, Math.round((log.count * 100) / TASBIH_DAILY_GOAL))
    : 0;
  return {
    count: log.count,
    dhikr: dhikrKey,
    dhikrAr,
    dhikrEn,
    dailyGoal: TASBIH_DAILY_GOAL,
    progressPercent,
    todayCount: log.count,
    currentDhikr: dhikrKey,
    currentDhikrAr: dhikrAr,
    currentDhikrEn: dhikrEn,
    currentDhikrCount: log.count,
    id: log.id,
    date: log.date,
    totalAllTime: (log as any).totalAllTime ?? log.totalAllTime ?? 0,
  };
}

async function getOrCreateToday(userId: string, date?: Date) {
  date ??= (await getUserLocalCalendarDay(userId)).date;
  return prisma.tasbihLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: {},
  });
}

/** Each daily row stores that day's lifetime contribution (reset does not erase it). */
async function withLifetimeTotal(userId: string, log: Parameters<typeof toContractTasbih>[0]) {
  const totals = await prisma.tasbihLog.aggregate({ where: { userId }, _sum: { totalAllTime: true } });
  return toContractTasbih({ ...log, totalAllTime: totals._sum.totalAllTime ?? 0 });
}

export async function getTodayTasbih(userId: string): Promise<ContractTasbih> {
  const tasbihLog = await getOrCreateToday(userId);
  return withLifetimeTotal(userId, tasbihLog);
}

export async function incrementTasbih(userId: string, amount = 1): Promise<ContractTasbih> {
  if (amount <= 0) {
    throw new AppError(
      'Amount must be greater than zero',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const { date } = await getUserLocalCalendarDay(userId);
  const current = await getOrCreateToday(userId, date);

  const tasbihLog = await prisma.tasbihLog.update({
    where: { id: current.id },
    data: {
      count: { increment: amount },
      totalAllTime: { increment: amount },
    },
  });

  return withLifetimeTotal(userId, tasbihLog);
}

export async function resetTasbih(userId: string): Promise<ContractTasbih> {
  const { date } = await getUserLocalCalendarDay(userId);
  const current = await getOrCreateToday(userId, date);

  const tasbihLog = await prisma.tasbihLog.update({
    where: { id: current.id },
    data: { count: 0 },
  });

  return withLifetimeTotal(userId, tasbihLog);
}

export async function changeDhikr(userId: string, dhikr: TasbihDhikr): Promise<ContractTasbih> {
  const { date } = await getUserLocalCalendarDay(userId);
  const tasbihLog = await prisma.tasbihLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, dhikr },
    update: { dhikr },
  });

  return withLifetimeTotal(userId, tasbihLog);
}

export async function getTasbihHistory(userId: string, limit = 30) {
  if (limit <= 0) {
    throw new AppError(
      'Limit must be greater than zero',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const history = await prisma.tasbihLog.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: limit,
  });

  return history.map((log) => ({
    id: log.id,
    date: log.date,
    dhikr: log.dhikr,
    count: log.count,
    totalAllTime: log.totalAllTime,
  }));
}

export type TasbihSummary = {
  days: number;
  from: string;
  to: string;
  total: number;
  activeDays: number;
  avgPerDay: number;
  avgPerActiveDay: number;
  goalMetDays: number;
  dailyGoal: number;
  bestDay: { date: string; count: number } | null;
  currentStreakDays: number;
  lifetimeTotal: number;
  perDay: Array<{ date: string; count: number; dhikr: string | null }>;
  perDhikr: Array<{ dhikr: string; dhikrAr: string; dhikrEn: string; total: number }>;
};

const dayKeyOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Totals for the last `days` days ending today in the user's timezone (missing days count as 0).
 * A day's figure is what was said that day, even if the counter was reset (totalAllTime per row).
 * The streak counts back from today, or from yesterday if nothing has been said yet today.
 */
export async function getTasbihSummary(userId: string, days = 7, now = new Date()): Promise<TasbihSummary> {
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new AppError('days must be between 1 and 366', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  const { date: today } = await getUserLocalCalendarDay(userId, now);
  const dayMs = 24 * 60 * 60 * 1000;
  const from = new Date(today.getTime() - (days - 1) * dayMs);
  const streakFrom = new Date(today.getTime() - 400 * dayMs);
  const [rows, streakRows, lifetime] = await Promise.all([
    prisma.tasbihLog.findMany({ where: { userId, date: { gte: from, lte: today } }, orderBy: { date: 'asc' } }),
    prisma.tasbihLog.findMany({
      where: { userId, date: { gte: streakFrom, lte: today }, totalAllTime: { gt: 0 } },
      select: { date: true },
      orderBy: { date: 'desc' },
    }),
    prisma.tasbihLog.aggregate({ where: { userId }, _sum: { totalAllTime: true } }),
  ]);
  const byDay = new Map(rows.map(r => [dayKeyOf(r.date), r]));
  const perDay: TasbihSummary['perDay'] = [];
  for (let i = 0; i < days; i += 1) {
    const key = dayKeyOf(new Date(from.getTime() + i * dayMs));
    const r = byDay.get(key);
    perDay.push({ date: key, count: Math.max(0, r?.totalAllTime ?? 0), dhikr: r ? String(r.dhikr) : null });
  }
  const total = perDay.reduce((s, d) => s + d.count, 0);
  const active = perDay.filter(d => d.count > 0);
  const best = active.reduce<{ date: string; count: number } | null>((b, d) => (!b || d.count > b.count ? { date: d.date, count: d.count } : b), null);
  const dhikrTotals = new Map<string, number>();
  for (const d of active) if (d.dhikr) dhikrTotals.set(d.dhikr, (dhikrTotals.get(d.dhikr) ?? 0) + d.count);

  const said = new Set(streakRows.map(r => dayKeyOf(r.date)));
  let cursor = said.has(dayKeyOf(today)) ? today : new Date(today.getTime() - dayMs);
  let streak = 0;
  while (said.has(dayKeyOf(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - dayMs);
  }

  return {
    days,
    from: dayKeyOf(from),
    to: dayKeyOf(today),
    total,
    activeDays: active.length,
    avgPerDay: Math.round(total / days),
    avgPerActiveDay: active.length ? Math.round(total / active.length) : 0,
    goalMetDays: perDay.filter(d => d.count >= TASBIH_DAILY_GOAL).length,
    dailyGoal: TASBIH_DAILY_GOAL,
    bestDay: best,
    currentStreakDays: streak,
    lifetimeTotal: lifetime._sum.totalAllTime ?? 0,
    perDay,
    perDhikr: [...dhikrTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([dhikr, t]) => ({ dhikr, dhikrAr: getDhikrArName(dhikr), dhikrEn: getDhikrEnName(dhikr), total: t })),
  };
}

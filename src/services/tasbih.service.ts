import type { TasbihDhikr } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';

function getTodayDateOnly(date = new Date()): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

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

async function getOrCreateToday(userId: string, date = getTodayDateOnly()) {
  return prisma.tasbihLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: {},
  });
}

export async function getTodayTasbih(userId: string): Promise<ContractTasbih> {
  const tasbihLog = await getOrCreateToday(userId);
  return toContractTasbih(tasbihLog);
}

export async function incrementTasbih(userId: string, amount = 1): Promise<ContractTasbih> {
  if (amount <= 0) {
    throw new AppError(
      'Amount must be greater than zero',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const date = getTodayDateOnly();
  const current = await getOrCreateToday(userId, date);

  const tasbihLog = await prisma.tasbihLog.update({
    where: { id: current.id },
    data: {
      count: { increment: amount },
      totalAllTime: { increment: amount },
    },
  });

  return toContractTasbih(tasbihLog);
}

export async function resetTasbih(userId: string): Promise<ContractTasbih> {
  const date = getTodayDateOnly();
  const current = await getOrCreateToday(userId, date);

  const tasbihLog = await prisma.tasbihLog.update({
    where: { id: current.id },
    data: { count: 0 },
  });

  return toContractTasbih(tasbihLog);
}

export async function changeDhikr(userId: string, dhikr: TasbihDhikr): Promise<ContractTasbih> {
  const date = getTodayDateOnly();
  const tasbihLog = await prisma.tasbihLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, dhikr },
    update: { dhikr },
  });

  return toContractTasbih(tasbihLog);
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

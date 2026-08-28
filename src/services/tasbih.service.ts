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
}

const dhikrArNamesMap: Record<Dhikr, string> = {
  [Dhikr.SUBHAN_ALLAH]: 'سبحان الله',
  [Dhikr.ALHAMDULILLAH]: 'الحمد لله',
  [Dhikr.LA_ILAHA_ILLA_ALLAH]: 'لا إله إلا الله',
  [Dhikr.ALLAHU_AKBAR]: 'الله أكبر',
  [Dhikr.ASTAGHFIRULLAH]: 'أستغفر الله',
  [Dhikr.LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH]: 'لا حول ولا قوة إلا بالله',
};

export function getDhikrArName(dhikr: string): string {
  const key = dhikr as Dhikr;
  return dhikrArNamesMap[key] ?? dhikr;
}

const TASBIH_DAILY_GOAL = 99;

export type ContractTasbih = {
  count: number;
  dhikr: string;
  dhikrAr: string;
  dailyGoal: number;
  progressPercent: number;
  todayCount?: number;
  currentDhikr?: string;
  currentDhikrAr?: string;
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
  const progressPercent = TASBIH_DAILY_GOAL > 0
    ? Math.min(100, Math.round((log.count * 100) / TASBIH_DAILY_GOAL))
    : 0;
  return {
    count: log.count,
    dhikr: dhikrKey,
    dhikrAr,
    dailyGoal: TASBIH_DAILY_GOAL,
    progressPercent,
    todayCount: log.count,
    currentDhikr: dhikrKey,
    currentDhikrAr: dhikrAr,
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

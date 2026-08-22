import { RevelationType } from '@prisma/client';

import { CATALOG_SURAHS } from '../data/surahs';
import { prisma } from './prisma';
import { logger } from './logger';

let syncing: Promise<void> | null = null;

export async function ensureSurahCatalog(): Promise<void> {
  if (!syncing) {
    syncing = syncSurahs().catch((error: unknown) => {
      syncing = null;
      logger.warn('Surah catalog sync failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }
  await syncing;
}

async function syncSurahs(): Promise<void> {
  const count = await prisma.surah.count();
  if (count >= 114) return;

  await prisma.surah.createMany({
    data: CATALOG_SURAHS.map((s) => ({
      id: s.id,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      totalAyahs: s.totalAyahs,
      totalPages: s.totalPages,
      revelationType: s.revelationType as RevelationType,
    })),
    skipDuplicates: true,
  });
}

export const FALLBACK_KHATMAH = {
  surahId: 2,
  surahNameEn: 'Al-Baqarah',
  surahNameAr: 'البقرة',
  currentPage: 1,
  totalPagesRead: 0,
  progressPercent: 0,
  isCompleted: false,
  completedKhatmahCount: 0,
};

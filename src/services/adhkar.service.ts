import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { logger } from '../lib/logger';
import { withPerfTiming } from '../lib/perf';
import { getDayOfYear } from '../utils/date';
import {
  ADHKAR_DHIKR_CATEGORIES_FALLBACK,
} from '../shared/constants/fallbacks';
import {
  ADHKAR_STATIC_CATALOG_VERSION,
  ADHKAR_STATIC_DOWNLOAD_PATH,
} from '../shared/constants/static-catalog';
import { ADHKAR_CATALOG_ITEMS, type AdhkarCatalogItem } from '../shared/data/adhkar-catalog';

const CATEGORY_KEYS = [
  'MORNING',
  'EVENING',
  'BEFORE_SLEEP',
  'ENTERING_MOSQUE',
  'AFTER_PRAYER',
  'GENERAL_WIRD',
  'TRAVEL',
  'SICK',
  'FOOD',
  'ISTIKHARA',
  'WUDU',
  'ISTIGHFAR',
  'QAYN',
  'MASJID_AFTER_SALAM',
] as const;

/** Hub "وردك اليوم" goal — must match getDailyWirdForUser / Flutter progress card. */
export const DAILY_WIRD_ITEM_GOAL = 8;

type CategoryKey = typeof CATEGORY_KEYS[number];

type FallbackItem = AdhkarCatalogItem & { id: string };

type FallbackCategory = {
  id: string;
  key: CategoryKey;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  iconCode: string;
  sortOrder: number;
  totalItems: number;
  items: FallbackItem[];
};

const FALLBACK_ID_PREFIX: Record<CategoryKey, string> = {
  MORNING: 'm',
  EVENING: 'e',
  BEFORE_SLEEP: 's',
  ENTERING_MOSQUE: 'mos',
  AFTER_PRAYER: 'p',
  GENERAL_WIRD: 'g',
  TRAVEL: 't',
  SICK: 'sk',
  FOOD: 'fd',
  ISTIKHARA: 'i',
  WUDU: 'w',
  ISTIGHFAR: 'is',
  QAYN: 'q',
  MASJID_AFTER_SALAM: 'ms',
};

const FALLBACK_ITEMS = Object.fromEntries(
  CATEGORY_KEYS.map((key) => [
    key,
    ADHKAR_CATALOG_ITEMS[key].map((item) => ({ ...item, id: `fb-${FALLBACK_ID_PREFIX[key]}-${item.orderInCategory}` })),
  ]),
) as Record<CategoryKey, FallbackItem[]>;

function buildCategoryFallback(key: CategoryKey): FallbackCategory {
  const base = ADHKAR_DHIKR_CATEGORIES_FALLBACK.find((c) => c.key === key);
  const items = FALLBACK_ITEMS[key] ?? [];
  return {
    id: `fb-cat-${key}`,
    key,
    nameAr: base?.nameAr ?? key,
    nameEn: base?.nameEn ?? key,
    descriptionAr: base?.descriptionAr ?? '',
    descriptionEn: base?.descriptionEn ?? '',
    iconCode: base?.iconCode ?? '📖',
    sortOrder: base?.sortOrder ?? 99,
    totalItems: items.length,
    items,
  };
}

const ALL_FALLBACK_CATEGORIES: FallbackCategory[] = CATEGORY_KEYS.map(buildCategoryFallback);

function getDayOfYearSafe(): number {
  try {
    return getDayOfYear();
  } catch {
    return Math.max(1, new Date().getDate());
  }
}

export async function getAllCategories() {
  try {
    const fromDb = await prisma.dhikrCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    if (fromDb && fromDb.length > 0) {
      return fromDb.map((c) => ({
        id: c.id,
        key: c.key,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        descriptionAr: c.descriptionAr,
        descriptionEn: c.descriptionEn,
        iconCode: c.iconCode,
        sortOrder: c.sortOrder,
        totalItems: c.totalItems,
      }));
    }
  } catch (err: any) {
    logger.warn('[Adhkar] getAllCategories prisma failed, returning hardcoded fallback categories', {
      code: err?.code,
      message: err?.message,
    });
  }

  return ALL_FALLBACK_CATEGORIES;
}

export async function getCategoryWithItems(key: string) {
  const normalizedKey = key.trim().toUpperCase();
  const match = CATEGORY_KEYS.find((k) => k === normalizedKey);

  try {
    const category = await prisma.dhikrCategory.findFirst({
      where: { key: (normalizedKey as any) },
      include: {
        items: {
          orderBy: { orderInCategory: 'asc' },
        },
      },
    });

    if (category) {
      return {
        id: category.id,
        key: category.key,
        nameAr: category.nameAr,
        nameEn: category.nameEn,
        descriptionAr: category.descriptionAr,
        descriptionEn: category.descriptionEn,
        iconCode: category.iconCode,
        sortOrder: category.sortOrder,
        totalItems: category.totalItems,
        markedItemId: null as string | null,
        items: category.items.map((it) => ({
          id: it.id,
          orderInCategory: it.orderInCategory,
          textAr: it.textAr,
          textEn: (it as any).textEn ?? '',
          textArPlain: ensureTextArPlain(it.textAr, it.textArPlain),
          repeatCount: it.repeatCount,
          referenceAr: it.referenceAr,
          referenceEn: it.referenceEn ?? '',
          sourceUrl: it.sourceUrl,
          benefitAr: it.benefitAr,
          benefitEn: (it as any).benefitEn ?? '',
        })),
      };
    }
  } catch (err: any) {
    logger.warn('[Adhkar] getCategoryWithItems prisma failed, returning fallback', {
      key: normalizedKey,
      code: err?.code,
      message: err?.message,
    });
  }

  if (match) {
    logger.warn('[Adhkar] DB had no DhikrCategory row for key in enum, returning hardcoded fallback', {
      key: normalizedKey,
    });
    return buildCategoryFallback(match);
  }

  throw new AppError(
    `Dhikr category not found for key: ${key}`,
    HttpStatus.NOT_FOUND,
    ErrorCodes.NOT_FOUND,
  );
}

export async function getDailyWird() {
  let wirdItems: FallbackItem[] = FALLBACK_ITEMS.GENERAL_WIRD;
  let wirdCategoryKey: CategoryKey = 'GENERAL_WIRD';

  try {
    const wirdCategory = await prisma.dhikrCategory.findFirst({
      where: { key: 'GENERAL_WIRD' },
      include: {
        items: {
          orderBy: { orderInCategory: 'asc' },
        },
      },
    });
    if (wirdCategory && wirdCategory.items.length > 0) {
      wirdItems = wirdCategory.items as unknown as FallbackItem[];
    }
  } catch (err: any) {
    logger.warn('[Adhkar] getDailyWird prisma failed, using fallback GENERAL_WIRD items', {
      code: err?.code,
      message: err?.message,
    });
  }

  const day = getDayOfYearSafe();
  const totalItems = wirdItems.length || 8;
  const goal = Math.min(8, totalItems);
  const progress = (((day * 37) % Math.max(1, goal)) + 1);

  const slice = wirdItems.slice(0, goal);

  return {
    titleAr: 'وردك اليوم',
    titleEn: 'Your Daily Wird',
    subtitleAr: 'واذكر ربك إذا نسيت',
    subtitleEn: 'And remember your Lord when you forget',
    progressItemsDone: progress,
    progressItemsTotal: goal,
    progressPercent: Math.round((progress / goal) * 100),
    ctaAr: 'اكمل وردك اليوم',
    ctaEn: 'Complete today\'s wird',
    categoryKey: wirdCategoryKey,
    items: slice.map((it, idx) => ({
      id: it.id,
      orderInCategory: it.orderInCategory ?? idx + 1,
      textAr: it.textAr,
      textEn: (it as any).textEn ?? '',
      textArPlain: ensureTextArPlain(it.textAr, (it as any).textArPlain),
      repeatCount: it.repeatCount,
      referenceAr: it.referenceAr,
      referenceEn: (it as any).referenceEn ?? '',
      benefitAr: it.benefitAr,
      benefitEn: (it as any).benefitEn ?? '',
    })),
  };
}

export async function getCategoriesWithDailyWird(userId?: string | null) {
  const [categories, dailyWird] = await Promise.all([
    getAllCategories(),
    userId ? getDailyWirdForUser(userId) : getDailyWird(),
  ]);

  return {
    greeting: 'واذكر ربك إذا نسيت',
    greetingEn: 'And remember your Lord when you forget',
    // Contract §4 — also expose daily-wird titles/CTAs at the home root
    titleAr: dailyWird.titleAr,
    titleEn: dailyWird.titleEn,
    ctaAr: dailyWird.ctaAr,
    ctaEn: dailyWird.ctaEn,
    dailyWird,
    categories,
  };
}

/**
 * Complete static Adhkar pack for Flutter one-time offline download.
 * No user progress / favorites / resume marks.
 */
export async function getAdhkarFullCatalog() {
  try {
    const fromDb = await prisma.dhikrCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        items: { orderBy: { orderInCategory: 'asc' } },
      },
    });

    if (fromDb.length > 0) {
      const categories = fromDb.map((category) => ({
        id: category.id,
        key: category.key,
        nameAr: category.nameAr,
        nameEn: category.nameEn,
        descriptionAr: category.descriptionAr,
        descriptionEn: category.descriptionEn,
        iconCode: category.iconCode,
        sortOrder: category.sortOrder,
        totalItems: category.totalItems,
        items: category.items.map((it) => ({
          id: it.id,
          orderInCategory: it.orderInCategory,
          textAr: it.textAr,
          textEn: (it as any).textEn ?? '',
          textArPlain: ensureTextArPlain(it.textAr, it.textArPlain),
          repeatCount: it.repeatCount,
          referenceAr: it.referenceAr,
          referenceEn: it.referenceEn ?? '',
          sourceUrl: it.sourceUrl,
          benefitAr: it.benefitAr,
          benefitEn: (it as any).benefitEn ?? '',
        })),
      }));

      const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
      return {
        meta: {
          catalogVersion: ADHKAR_STATIC_CATALOG_VERSION,
          contentHash: `adhkar-v${ADHKAR_STATIC_CATALOG_VERSION}-${categories.length}-${totalItems}`,
          totalCategories: categories.length,
          totalItems,
          downloadPath: ADHKAR_STATIC_DOWNLOAD_PATH,
        },
        categories,
      };
    }
  } catch (err: any) {
    logger.warn('[Adhkar] getAdhkarFullCatalog prisma failed, using per-key fallback', {
      code: err?.code,
      message: err?.message,
    });
  }

  const categories = [];
  for (const key of CATEGORY_KEYS) {
    const cat = await getCategoryWithItems(key);
    const { markedItemId: _ignore, ...rest } = cat as typeof cat & { markedItemId?: string | null };
    categories.push(rest);
  }

  const totalItems = categories.reduce((sum, c) => sum + (c.items?.length ?? 0), 0);
  return {
    meta: {
      catalogVersion: ADHKAR_STATIC_CATALOG_VERSION,
      contentHash: `adhkar-v${ADHKAR_STATIC_CATALOG_VERSION}-${categories.length}-${totalItems}`,
      totalCategories: categories.length,
      totalItems,
      downloadPath: ADHKAR_STATIC_DOWNLOAD_PATH,
    },
    categories,
  };
}

/** Lightweight Adhkar version probe — no item texts. */
export async function getAdhkarStaticMeta() {
  try {
    const [totalCategories, totalItems] = await Promise.all([
      prisma.dhikrCategory.count(),
      prisma.dhikrItem.count(),
    ]);
    if (totalCategories > 0) {
      return {
        catalogVersion: ADHKAR_STATIC_CATALOG_VERSION,
        contentHash: `adhkar-v${ADHKAR_STATIC_CATALOG_VERSION}-${totalCategories}-${totalItems}`,
        totalCategories,
        totalItems,
        downloadPath: ADHKAR_STATIC_DOWNLOAD_PATH,
      };
    }
  } catch (err: any) {
    logger.warn('[Adhkar] getAdhkarStaticMeta prisma failed, using fallback counts', {
      code: err?.code,
      message: err?.message,
    });
  }

  const fallbackCats = ALL_FALLBACK_CATEGORIES.length;
  const fallbackItems = ALL_FALLBACK_CATEGORIES.reduce((s, c) => s + (c.totalItems ?? 0), 0);
  return {
    catalogVersion: ADHKAR_STATIC_CATALOG_VERSION,
    contentHash: `adhkar-v${ADHKAR_STATIC_CATALOG_VERSION}-${fallbackCats}-${fallbackItems}`,
    totalCategories: fallbackCats,
    totalItems: fallbackItems,
    downloadPath: ADHKAR_STATIC_DOWNLOAD_PATH,
  };
}

// ============================================================
//  Adhkar Progress — resume mark + tap counts per user per day
// ============================================================

function getTodayDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Whether every item in a category (or first `limit` items) is completed today
 * for this user. Source of truth: DailyDhikrCompletion.countDone >= repeatCount.
 */
async function isCategoryCompleteForUser(
  userId: string,
  categoryKey: CategoryKey,
  date: Date,
  limit?: number,
): Promise<boolean> {
  try {
    const dbCat = await prisma.dhikrCategory.findFirst({
      where: { key: categoryKey as any },
      include: {
        items: {
          orderBy: { orderInCategory: 'asc' },
          ...(limit ? { take: limit } : {}),
          select: { id: true, repeatCount: true },
        },
      },
    });

    let items = dbCat?.items ?? [];
    if (!dbCat || items.length === 0) {
      const fallback = FALLBACK_ITEMS[categoryKey] ?? [];
      items = (limit ? fallback.slice(0, limit) : fallback).map((fi) => ({
        id: fi.id,
        repeatCount: fi.repeatCount,
      }));
    }
    if (items.length === 0) return false;

    const completions = await prisma.dailyDhikrCompletion.findMany({
      where: {
        userId,
        date,
        itemId: { in: items.map((i) => i.id) },
        ...(dbCat?.id ? { categoryId: dbCat.id } : {}),
      },
      select: { itemId: true, countDone: true },
    });
    const map = new Map(completions.map((c) => [c.itemId, c.countDone]));
    return items.every((item) => (map.get(item.id) ?? 0) >= item.repeatCount);
  } catch {
    return false;
  }
}

/**
 * Mark category items complete in DailyDhikrCompletion (same ledger as PUT /adhkar/progress).
 * Used by PATCH /journey/adhkar so Dashboard re-sync does not wipe the override.
 */
async function markCategoryItemsCompleteInLedger(
  userId: string,
  categoryKey: CategoryKey,
  date: Date,
  limit?: number,
): Promise<void> {
  let categoryId: string | null = null;
  let items: { id: string; repeatCount: number }[] = [];

  try {
    const dbCat = await prisma.dhikrCategory.findFirst({
      where: { key: categoryKey as any },
      include: {
        items: {
          orderBy: { orderInCategory: 'asc' },
          ...(limit ? { take: limit } : {}),
          select: { id: true, repeatCount: true },
        },
      },
    });
    if (dbCat) {
      categoryId = dbCat.id;
      items = dbCat.items;
    }
  } catch {
    /* fallback below */
  }

  if (items.length === 0) {
    const fallback = FALLBACK_ITEMS[categoryKey] ?? [];
    items = (limit ? fallback.slice(0, limit) : fallback).map((fi) => ({
      id: fi.id,
      repeatCount: fi.repeatCount,
    }));
  }

  for (const item of items) {
    try {
      await prisma.dailyDhikrCompletion.upsert({
        where: {
          userId_date_categoryId_itemId: {
            userId,
            date,
            categoryId: categoryId ?? '',
            itemId: item.id,
          },
        },
        create: {
          userId,
          date,
          categoryId,
          itemId: item.id,
          countDone: item.repeatCount,
        },
        update: {
          countDone: item.repeatCount,
        },
      });
    } catch {
      /* table / unique edge — ignore single item */
    }
  }
}

export type AdhkarJourneyFlags = {
  morningAdhkarCompleted: boolean;
  eveningAdhkarCompleted: boolean;
  adhkarCompleted: boolean;
  /** Additive — same numbers as Azkar hub "وردك اليوم". */
  progressItemsDone: number;
  progressItemsTotal: number;
  progressPercent: number;
};

/**
 * Cosmetic "وردك اليوم" counters used when GENERAL_WIRD is missing/empty in DB.
 * Must match getDailyWird() / getDailyWirdForUser() degraded-path formula exactly.
 */
export function getCosmeticWirdProgress(fallbackItemCount?: number): {
  progressItemsDone: number;
  progressItemsTotal: number;
  progressPercent: number;
} {
  const totalItems =
    fallbackItemCount && fallbackItemCount > 0
      ? fallbackItemCount
      : FALLBACK_ITEMS.GENERAL_WIRD?.length || 8;
  const goal = Math.min(8, totalItems);
  const day = getDayOfYearSafe();
  const progress = (((day * 37) % Math.max(1, goal)) + 1);
  return {
    progressItemsDone: progress,
    progressItemsTotal: goal,
    progressPercent: Math.round((progress / goal) * 100),
  };
}

/**
 * Apply Journey Adhkar PATCH onto the Dhikr ledger, then re-derive DailyProgress.
 * Keeps one source of truth so GET /dashboard stays aligned.
 */
export async function applyJourneyAdhkarToDhikrLedger(
  userId: string,
  input: {
    morningCompleted?: boolean;
    eveningCompleted?: boolean;
    wirdCompleted?: boolean;
  },
): Promise<AdhkarJourneyFlags> {
  const date = getTodayDate();

  if (input.wirdCompleted) {
    await markCategoryItemsCompleteInLedger(
      userId,
      'GENERAL_WIRD',
      date,
      DAILY_WIRD_ITEM_GOAL,
    );
  }
  if (input.morningCompleted) {
    await markCategoryItemsCompleteInLedger(userId, 'MORNING', date);
  }
  if (input.eveningCompleted) {
    await markCategoryItemsCompleteInLedger(userId, 'EVENING', date);
  }

  return syncJourneyAdhkarFromDhikr(userId, date);
}

/**
 * Pure derivation of Journey/Dashboard Adhkar flags from category items + completions.
 * Kept identical to prior isCategoryCompleteForUser + wird progress rules.
 */
export function deriveAdhkarJourneyFlags(input: {
  morningItems: Array<{ id: string; repeatCount: number }>;
  eveningItems: Array<{ id: string; repeatCount: number }>;
  wirdItems: Array<{ id: string; repeatCount: number }>;
  /** itemId → countDone (already filtered to the relevant category when applicable) */
  morningDoneByItem: Map<string, number>;
  eveningDoneByItem: Map<string, number>;
  wirdDoneByItem: Map<string, number>;
}): AdhkarJourneyFlags {
  const isComplete = (
    items: Array<{ id: string; repeatCount: number }>,
    doneByItem: Map<string, number>,
  ): boolean => {
    if (items.length === 0) return false;
    return items.every((item) => (doneByItem.get(item.id) ?? 0) >= item.repeatCount);
  };

  const morningDone = isComplete(input.morningItems, input.morningDoneByItem);
  const eveningDone = isComplete(input.eveningItems, input.eveningDoneByItem);
  const wirdDone = isComplete(input.wirdItems, input.wirdDoneByItem);

  let progressItemsDone = 0;
  for (const item of input.wirdItems) {
    if ((input.wirdDoneByItem.get(item.id) ?? 0) >= item.repeatCount) {
      progressItemsDone += 1;
    }
  }
  const progressItemsTotal =
    input.wirdItems.length > 0 ? input.wirdItems.length : DAILY_WIRD_ITEM_GOAL;
  const progressPercent =
    progressItemsTotal > 0
      ? Math.round((progressItemsDone / progressItemsTotal) * 100)
      : 0;

  const overall = wirdDone || (morningDone && eveningDone);
  return {
    morningAdhkarCompleted: morningDone || wirdDone,
    eveningAdhkarCompleted: eveningDone || wirdDone,
    adhkarCompleted: overall,
    progressItemsDone,
    progressItemsTotal,
    progressPercent,
  };
}

/**
 * Single source of truth for Azkar hub + Dashboard Journey:
 * DailyDhikrCompletion for today → derived DailyProgress flags.
 *
 * - MORNING all items done → morningAdhkarCompleted
 * - EVENING all items done → eveningAdhkarCompleted
 * - First 8 GENERAL_WIRD items done → daily wird complete
 * - adhkarCompleted = wirdDone OR (morning && evening)
 * - When wird is done, morning+evening are also set so Journey percent hits 100%
 *
 * Phase 1: batched category + completion reads (same semantics as prior N queries).
 */
export async function syncJourneyAdhkarFromDhikr(
  userId: string,
  date = getTodayDate(),
): Promise<AdhkarJourneyFlags> {
  return withPerfTiming('adhkar.syncJourneyAdhkarFromDhikr', async () => {
    const syncKeys = ['MORNING', 'EVENING', 'GENERAL_WIRD'] as const;

    type CatRow = {
      id: string;
      key: string;
      items: Array<{ id: string; repeatCount: number; orderInCategory: number }>;
    };

    let categories: CatRow[] = [];
    try {
      categories = await prisma.dhikrCategory.findMany({
        where: { key: { in: [...syncKeys] as any } },
        select: {
          id: true,
          key: true,
          items: {
            orderBy: { orderInCategory: 'asc' },
            select: { id: true, repeatCount: true, orderInCategory: true },
          },
        },
      });
    } catch {
      categories = [];
    }

    const byKey = new Map(categories.map((c) => [String(c.key), c] as const));

    const resolveItems = (
      key: (typeof syncKeys)[number],
      limit?: number,
    ): { categoryId: string | undefined; items: Array<{ id: string; repeatCount: number }> } => {
      const dbCat = byKey.get(key);
      let items = dbCat?.items ?? [];
      if (!dbCat || items.length === 0) {
        const fallback = FALLBACK_ITEMS[key] ?? [];
        const sliced = limit ? fallback.slice(0, limit) : fallback;
        return {
          categoryId: undefined,
          items: sliced.map((fi) => ({ id: fi.id, repeatCount: fi.repeatCount })),
        };
      }
      if (limit) items = items.slice(0, limit);
      return {
        categoryId: dbCat.id,
        items: items.map((it) => ({ id: it.id, repeatCount: it.repeatCount })),
      };
    };

    const morning = resolveItems('MORNING');
    const evening = resolveItems('EVENING');
    const wird = resolveItems('GENERAL_WIRD', DAILY_WIRD_ITEM_GOAL);

    const allItemIds = Array.from(
      new Set([
        ...morning.items.map((i) => i.id),
        ...evening.items.map((i) => i.id),
        ...wird.items.map((i) => i.id),
      ]),
    );

    type CompletionRow = { itemId: string | null; countDone: number; categoryId: string | null };
    let completions: CompletionRow[] = [];
    if (allItemIds.length > 0) {
      try {
        completions = await prisma.dailyDhikrCompletion.findMany({
          where: {
            userId,
            date,
            itemId: { in: allItemIds },
          },
          select: { itemId: true, countDone: true, categoryId: true },
        });
      } catch {
        completions = [];
      }
    }

    const mapForCategory = (categoryId: string | undefined): Map<string, number> => {
      const map = new Map<string, number>();
      for (const row of completions) {
        if (!row.itemId) continue;
        if (categoryId && row.categoryId !== categoryId) continue;
        map.set(row.itemId, row.countDone);
      }
      return map;
    };

    const flags = deriveAdhkarJourneyFlags({
      morningItems: morning.items,
      eveningItems: evening.items,
      wirdItems: wird.items,
      morningDoneByItem: mapForCategory(morning.categoryId),
      eveningDoneByItem: mapForCategory(evening.categoryId),
      wirdDoneByItem: mapForCategory(wird.categoryId),
    });

    // Degraded path: GENERAL_WIRD missing/empty in DB.
    // Keep completion flags from fallback ledger (same as old isCategoryCompleteForUser),
    // but restore OLD cosmetic progressItems* from getDailyWirdForUser → baseWird.
    const resultFlags: AdhkarJourneyFlags = !wird.categoryId
      ? {
          ...flags,
          ...getCosmeticWirdProgress(FALLBACK_ITEMS.GENERAL_WIRD?.length),
        }
      : flags;

    try {
      await prisma.dailyProgress.upsert({
        where: { userId_date: { userId, date } },
        create: {
          userId,
          date,
          morningAdhkarCompleted: resultFlags.morningAdhkarCompleted,
          eveningAdhkarCompleted: resultFlags.eveningAdhkarCompleted,
          adhkarCompleted: resultFlags.adhkarCompleted,
        },
        update: {
          morningAdhkarCompleted: resultFlags.morningAdhkarCompleted,
          eveningAdhkarCompleted: resultFlags.eveningAdhkarCompleted,
          adhkarCompleted: resultFlags.adhkarCompleted,
        },
      });
    } catch (err: any) {
      logger.warn('[Adhkar] syncJourneyAdhkarFromDhikr DailyProgress upsert failed', {
        userId,
        message: err?.message,
      });
    }

    return resultFlags;
  });
}

export async function getAdhkarProgress(userId: string, categoryKey: string) {
  const key = categoryKey.toUpperCase() as CategoryKey;
  if (!CATEGORY_KEYS.includes(key as any)) {
    throw new AppError(
      `Invalid category key: ${categoryKey}`,
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const date = getTodayDate();

  // Find the category (DB or fallback)
  let category: { id: string; key: string; totalItems: number } | null = null;
  let items: { id: string; orderInCategory: number; textAr: string; repeatCount: number }[] = [];

  try {
    const dbCat = await prisma.dhikrCategory.findFirst({
      where: { key: key as any },
      include: {
        items: {
          orderBy: { orderInCategory: 'asc' },
          select: { id: true, orderInCategory: true, textAr: true, repeatCount: true },
        },
      },
    });
    if (dbCat) {
      category = { id: dbCat.id, key: dbCat.key, totalItems: dbCat.items.length };
      items = dbCat.items;
    }
  } catch {
    // fallback
  }

  // Use fallback if DB didn't return
  if (!category || items.length === 0) {
    const fallbackItems = FALLBACK_ITEMS[key] ?? [];
    items = fallbackItems.map((fi, idx) => ({
      id: fi.id,
      orderInCategory: fi.orderInCategory ?? idx + 1,
      textAr: fi.textAr,
      repeatCount: fi.repeatCount,
    }));
  }

  // Hub "وردك اليوم" goal is first 8 items — keep progress totals consistent.
  if (key === 'GENERAL_WIRD' && items.length > DAILY_WIRD_ITEM_GOAL) {
    items = items.slice(0, DAILY_WIRD_ITEM_GOAL);
  }

  // Get user's completions for today + this category.
  // Wrapped in try/catch: if the table doesn't exist yet (pending migration) we
  // gracefully return all-zero progress rather than a 500.
  let completions: Array<{ itemId: string | null; countDone: number }> = [];
  try {
    completions = await prisma.dailyDhikrCompletion.findMany({
      where: {
        userId,
        date,
        ...(category?.id ? { categoryId: category.id } : {}),
      },
      select: { itemId: true, countDone: true },
    });
  } catch {
    // Table may not exist on this environment yet — fall through with empty completions.
  }

  const completionMap = new Map(completions.map((c) => [c.itemId, c.countDone]));

  const itemProgress = items.map((item) => {
    const tapCount = completionMap.get(item.id) ?? 0;
    return {
      itemId: item.id,
      tapCount,
      completed: tapCount >= item.repeatCount,
    };
  });

  const progressItemsDone = itemProgress.filter((ip) => ip.completed).length;
  const progressItemsTotal = items.length;

  // Find the first non-completed item as resume mark
  const firstIncomplete = itemProgress.find((ip) => !ip.completed);
  const markedItemId = firstIncomplete?.itemId ?? (items[items.length - 1]?.id ?? null);

  return {
    categoryKey: key,
    markedItemId,
    items: itemProgress,
    progressItemsDone,
    progressItemsTotal,
    progressPercent: progressItemsTotal > 0
      ? Math.round((progressItemsDone / progressItemsTotal) * 100)
      : 0,
  };
}

export async function saveAdhkarProgress(
  userId: string,
  categoryKey: string,
  itemId: string,
  tapCount: number,
) {
  const key = categoryKey.toUpperCase() as CategoryKey;
  if (!CATEGORY_KEYS.includes(key as any)) {
    throw new AppError(
      `Invalid category key: ${categoryKey}`,
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  if (tapCount < 0) {
    throw new AppError(
      'tapCount must be zero or greater',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const date = getTodayDate();

  // Resolve categoryId
  let categoryId: string | null = null;
  try {
    const dbCat = await prisma.dhikrCategory.findFirst({
      where: { key: key as any },
      select: { id: true },
    });
    categoryId = dbCat?.id ?? null;
  } catch {
    // fallback categories have no DB id
  }

  // Upsert the completion — wrapped in try/catch so a missing table degrades
  // gracefully instead of returning 500 to Flutter.
  try {
    await prisma.dailyDhikrCompletion.upsert({
      where: {
        userId_date_categoryId_itemId: {
          userId,
          date,
          categoryId: categoryId ?? '',
          itemId,
        },
      },
      create: {
        userId,
        date,
        categoryId,
        itemId,
        countDone: tapCount,
      },
      update: {
        countDone: tapCount,
      },
    });
  } catch {
    // Table doesn't exist yet — progress will be returned from in-memory fallback.
  }

  // Keep Dashboard / Journey DailyProgress in sync with item completions (same day).
  await syncJourneyAdhkarFromDhikr(userId, date).catch((err) => {
    logger.warn('[Adhkar] journey sync after progress save failed', {
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
  });

  // Return full progress
  return getAdhkarProgress(userId, key);
}


// ============================================================
// Adhkar Favorites (حفظ الأذكار المفضلة)
// ============================================================

/**
 * List user's favorite adhkar
 */
export async function listAdhkarFavorites(userId: string) {
  const favorites: any = await prisma.adhkarFavorite.findMany({
    where: { userId },
    include: {
      item: {
        include: {
          category: {
            select: {
              id: true,
              key: true,
              nameAr: true,
              nameEn: true,
              iconCode: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return favorites.map((fav: any) => ({
    id: fav.id,
    itemId: fav.itemId,
    dhikr: {
      id: fav.item.id,
      textAr: fav.item.textAr,
      textEn: '',
      textArPlain: ensureTextArPlain(fav.item.textAr, fav.item.textArPlain),
      repeatCount: fav.item.repeatCount,
      referenceAr: fav.item.referenceAr,
      referenceEn: fav.item.referenceEn ?? '',
      benefitAr: fav.item.benefitAr,
      benefitEn: '',
      category: fav.item.category,
    },
    createdAt: fav.createdAt.toISOString(),
  }));
}

/**
 * Add adhkar to favorites
 */
export async function addAdhkarFavorite(userId: string, itemId: string) {
  // Check if item exists
  const item = await prisma.dhikrItem.findUnique({
    where: { id: itemId },
  });

  if (!item) {
    throw new AppError('Dhikr item not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  // Check if already favorited
  const existing = await prisma.adhkarFavorite.findUnique({
    where: {
      userId_itemId: {
        userId,
        itemId,
      },
    },
  });

  if (existing) {
    throw new AppError('This dhikr is already in your favorites', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
  }

  // Create favorite
  const favorite: any = await prisma.adhkarFavorite.create({
    data: {
      userId,
      itemId,
    },
    include: {
      item: {
        include: {
          category: {
            select: {
              id: true,
              key: true,
              nameAr: true,
              nameEn: true,
              iconCode: true,
            },
          },
        },
      },
    },
  });

  const fav: any = favorite;

  return {
    id: fav.id,
    itemId: fav.itemId,
    dhikr: {
      id: fav.item.id,
      textAr: fav.item.textAr,
      textEn: '',
      textArPlain: ensureTextArPlain(fav.item.textAr, fav.item.textArPlain),
      repeatCount: fav.item.repeatCount,
      referenceAr: fav.item.referenceAr,
      referenceEn: fav.item.referenceEn ?? '',
      benefitAr: fav.item.benefitAr,
      benefitEn: '',
      category: fav.item.category,
    },
    createdAt: fav.createdAt.toISOString(),
  };
}

/**
 * Remove adhkar from favorites
 */
export async function removeAdhkarFavorite(userId: string, favoriteId: string) {
  // Check ownership
  const favorite = await prisma.adhkarFavorite.findUnique({
    where: { id: favoriteId },
  });

  if (!favorite || favorite.userId !== userId) {
    throw new AppError('Favorite not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  await prisma.adhkarFavorite.delete({
    where: { id: favoriteId },
  });

  return { message: 'Favorite removed successfully' };
}

/**
 * Check if adhkar is favorited
 */
export async function isAdhkarFavorited(userId: string, itemId: string): Promise<boolean> {
  const favorite = await prisma.adhkarFavorite.findUnique({
    where: {
      userId_itemId: {
        userId,
        itemId,
      },
    },
  });

  return !!favorite;
}

// ============================================================
// Search adhkar across all categories (DB + fallback)
// ============================================================

function stripTashkeel(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureTextArPlain(textAr: string, textArPlain?: string | null): string {
  const plain = (textArPlain ?? '').toString().trim();
  if (plain.length > 0) return plain;
  return stripTashkeel(textAr ?? '');
}

type SearchResultItem = {
  id: string;
  categoryKey: string;
  categoryNameAr: string;
  categoryNameEn: string;
  orderInCategory: number;
  textAr: string;
  textEn: string;
  textArPlain?: string;
  repeatCount: number;
  referenceAr?: string;
  referenceEn?: string;
  benefitAr?: string;
  benefitEn?: string;
  sourceUrl?: string;
  matchScore: number;
};

/**
 * Search across all DhikrItem (DB) + fallback items in all categories.
 * Matches are scored on: textAr (plain/tashkeel-insensitive), referenceAr, benefitAr.
 */
export async function searchAdhkar(
  qRaw: string,
  options: { limit?: number; categoryKey?: string } = {},
): Promise<{
  query: string;
  total: number;
  limit: number;
  items: SearchResultItem[];
}> {
  const queryRaw = (qRaw ?? '').trim();
  const limit = Math.max(1, Math.min(100, options.limit ?? 50));

  if (queryRaw.length === 0) {
    return { query: queryRaw, total: 0, limit, items: [] };
  }

  const queryStripped = stripTashkeel(queryRaw).toLowerCase();
  const queryTokens = queryStripped
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1);

  const categoryFilterKey = options.categoryKey
    ? String(options.categoryKey).toUpperCase()
    : null;

  // 1) Aggregate a pool of items: DB rows first, fallback for any category
  const pool: Array<Omit<SearchResultItem, 'matchScore'>> = [];

  // 1a) DB DhikrItem rows (join category)
  try {
    const dbItems = await prisma.dhikrItem.findMany({
      where: categoryFilterKey
        ? {
          category: { key: categoryFilterKey as any },
        }
        : undefined,
      include: {
        category: {
          select: { key: true, nameAr: true, nameEn: true },
        },
      },
      take: 2000,
    });

    for (const it of dbItems) {
      if (!it.category) continue;
      pool.push({
        id: it.id,
        categoryKey: String(it.category.key),
        categoryNameAr: it.category.nameAr,
        categoryNameEn: it.category.nameEn,
        orderInCategory: it.orderInCategory,
        textAr: it.textAr,
        textEn: '',
        textArPlain: ensureTextArPlain(it.textAr, it.textArPlain),
        repeatCount: it.repeatCount,
        referenceAr: it.referenceAr ?? undefined,
        referenceEn: it.referenceEn ?? '',
        benefitAr: it.benefitAr ?? undefined,
        benefitEn: '',
        sourceUrl: it.sourceUrl ?? undefined,
      });
    }
  } catch (err: any) {
    logger.warn('[Adhkar] searchAdhkar DB query failed, relying on hardcoded fallbacks only', {
      code: err?.code,
      message: err?.message,
    });
  }

  // 1b) Add fallback items only for categories where the DB returned zero rows,
  //     OR when no categoryFilter and pool is still small.
  const fallbackKeysToInclude: CategoryKey[] = [];
  for (const key of CATEGORY_KEYS) {
    if (categoryFilterKey && key !== categoryFilterKey) continue;
    const hasDbRowsForCategory = pool.some(
      (p) => String(p.categoryKey).toUpperCase() === key,
    );
    if (!hasDbRowsForCategory) fallbackKeysToInclude.push(key);
  }

  for (const key of fallbackKeysToInclude) {
    const fallback = buildCategoryFallback(key);
    for (const it of fallback.items) {
      pool.push({
        id: it.id,
        categoryKey: fallback.key,
        categoryNameAr: fallback.nameAr,
        categoryNameEn: fallback.nameEn,
        orderInCategory: it.orderInCategory,
        textAr: it.textAr,
        textEn: '',
        textArPlain: ensureTextArPlain(it.textAr, undefined),
        repeatCount: it.repeatCount,
        referenceAr: it.referenceAr ?? undefined,
        referenceEn: '',
        benefitAr: it.benefitAr ?? undefined,
        benefitEn: '',
      });
    }
  }

  // 2) Score and filter
  const scored: SearchResultItem[] = [];
  for (const item of pool) {
    const haystack = stripTashkeel(
      [
        item.textAr,
        item.textArPlain ?? '',
        item.referenceAr ?? '',
        item.referenceEn ?? '',
        item.benefitAr ?? '',
        item.benefitEn ?? '',
        item.categoryNameAr,
        item.categoryNameEn,
      ]
        .filter(Boolean)
        .join(' \n '),
    ).toLowerCase();

    if (!haystack) continue;

    // Exact substring on stripped haystack -> highest score
    let score = 0;
    if (queryStripped.length >= 2 && haystack.includes(queryStripped)) {
      score += 100;
    }

    // Token matches
    let tokenHits = 0;
    for (const tok of queryTokens) {
      if (haystack.includes(tok)) {
        tokenHits += 1;
        score += 10 * tok.length;
      }
    }

    // Bonus if it's a match on textAr specifically (the main field)
    const textStripped = stripTashkeel(item.textAr + ' ' + (item.textArPlain ?? ''))
      .toLowerCase();
    if (queryStripped.length >= 2 && textStripped.includes(queryStripped)) {
      score += 50;
    }
    for (const tok of queryTokens) {
      if (tok.length >= 2 && textStripped.includes(tok)) {
        score += 15;
      }
    }

    if (score > 0 || tokenHits >= 1) {
      scored.push({ ...item, matchScore: score });
    }
  }

  // 3) Sort desc by score, then apply limit
  scored.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (a.categoryKey !== b.categoryKey) return a.categoryKey.localeCompare(b.categoryKey);
    return a.orderInCategory - b.orderInCategory;
  });

  const items = scored.slice(0, limit);

  return {
    query: queryRaw,
    total: scored.length,
    limit,
    items,
  };
}


// ============================================================
//  Adhkar Resume Mark — persist bookmark position per user
// ============================================================

export async function getCategoryWithItemsForUser(key: string, userId: string) {
  const category = await getCategoryWithItems(key);

  // Get user's resume mark for this category
  try {
    const resumeMark = await prisma.adhkarResumeMark.findUnique({
      where: {
        userId_categoryKey: {
          userId,
          categoryKey: key.trim().toUpperCase(),
        },
      },
      select: { markedItemId: true },
    });

    if (resumeMark) {
      return {
        ...category,
        markedItemId: resumeMark.markedItemId,
      };
    }
  } catch (err: any) {
    logger.warn('[Adhkar] Failed to fetch resume mark, returning category without mark', {
      userId,
      categoryKey: key,
      code: err?.code,
    });
  }

  return category;
}

export async function saveResumeMark(
  userId: string,
  categoryKey: string,
  markedItemId: string,
): Promise<{ markedItemId: string }> {
  const normalizedKey = categoryKey.trim().toUpperCase();

  try {
    const mark = await prisma.adhkarResumeMark.upsert({
      where: {
        userId_categoryKey: {
          userId,
          categoryKey: normalizedKey,
        },
      },
      create: {
        userId,
        categoryKey: normalizedKey,
        markedItemId,
      },
      update: {
        markedItemId,
      },
      select: { markedItemId: true },
    });

    return { markedItemId: mark.markedItemId };
  } catch (err: any) {
    logger.error('[Adhkar] Failed to save resume mark', {
      userId,
      categoryKey: normalizedKey,
      markedItemId,
      code: err?.code,
      message: err?.message,
    });
    throw new AppError(
      'Failed to save resume mark',
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorCodes.DATABASE_ERROR,
    );
  }
}

// ============================================================
//  Real Daily Wird Progress (for signed-in users)
// ============================================================

export async function getDailyWirdForUser(userId: string) {
  const baseWird = await getDailyWird();

  // Calculate real progress from user's completions
  const date = getTodayDate();

  try {
    const wirdCategory = await prisma.dhikrCategory.findFirst({
      where: { key: 'GENERAL_WIRD' },
      include: {
        items: {
          orderBy: { orderInCategory: 'asc' },
          take: 8, // Daily wird goal is 8 items
        },
      },
    });

    if (!wirdCategory || wirdCategory.items.length === 0) {
      return baseWird; // Fallback to cosmetic progress
    }

    const itemIds = wirdCategory.items.map((it) => it.id);

    const completions = await prisma.dailyDhikrCompletion.findMany({
      where: {
        userId,
        date,
        categoryId: wirdCategory.id,
        itemId: { in: itemIds },
      },
      select: { itemId: true, countDone: true },
    });

    const completionMap = new Map(
      completions.map((c) => [c.itemId, c.countDone]),
    );

    // Count how many items are done (countDone >= repeatCount)
    let itemsDone = 0;
    for (const item of wirdCategory.items) {
      const done = completionMap.get(item.id) ?? 0;
      if (done >= item.repeatCount) {
        itemsDone += 1;
      }
    }

    const total = wirdCategory.items.length;
    const percent = total > 0 ? Math.round((itemsDone / total) * 100) : 0;

    return {
      ...baseWird,
      progressItemsDone: itemsDone,
      progressItemsTotal: total,
      progressPercent: percent,
    };
  } catch (err: any) {
    logger.warn('[Adhkar] Failed to calculate real wird progress, using cosmetic', {
      userId,
      code: err?.code,
      message: err?.message,
    });
    return baseWird;
  }
}

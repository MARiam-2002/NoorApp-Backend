/**
 * Journey screen level / rank ladder.
 * Derived from User.points — one source of truth for level + rank titles.
 * Additive helpers only; does not replace DailyProgress activity tracking.
 */

export type JourneyRank = {
  level: number;
  minPoints: number;
  titleAr: string;
  titleEn: string;
};

/** Fixed ladder so Flutter can cache labels; last tier has no upper bound. */
export const JOURNEY_RANKS: readonly JourneyRank[] = [
  { level: 1, minPoints: 0, titleAr: 'مؤمن جديد', titleEn: 'New believer' },
  { level: 2, minPoints: 100, titleAr: 'مجتهد', titleEn: 'Diligent' },
  { level: 3, minPoints: 300, titleAr: 'مواظب', titleEn: 'Consistent' },
  { level: 4, minPoints: 600, titleAr: 'مداوم', titleEn: 'Persistent' },
  { level: 5, minPoints: 1000, titleAr: 'عابد', titleEn: 'Worshipper' },
  { level: 6, minPoints: 1500, titleAr: 'عبد شاكر', titleEn: 'Grateful servant' },
  { level: 7, minPoints: 2200, titleAr: 'عبد صابر', titleEn: 'Patient servant' },
  { level: 8, minPoints: 3000, titleAr: 'عبد محسن', titleEn: 'Excellent servant' },
  { level: 9, minPoints: 4000, titleAr: 'خاشع', titleEn: 'Humble' },
  { level: 10, minPoints: 5500, titleAr: 'مقرب', titleEn: 'Close to Allah' },
] as const;

export type JourneyLevelProgress = {
  level: number;
  rankTitleAr: string;
  rankTitleEn: string;
  /** 0–100 progress within the current level toward the next. */
  levelProgressPercent: number;
  points: number;
  pointsInLevel: number;
  pointsToNextLevel: number;
  nextLevel: number | null;
  nextRankTitleAr: string | null;
  nextRankTitleEn: string | null;
  isMaxLevel: boolean;
};

function clampPoints(points: number): number {
  if (!Number.isFinite(points) || points < 0) return 0;
  return Math.floor(points);
}

export function resolveRankFromPoints(points: number): JourneyRank {
  const p = clampPoints(points);
  let current = JOURNEY_RANKS[0]!;
  for (const rank of JOURNEY_RANKS) {
    if (p >= rank.minPoints) current = rank;
    else break;
  }
  return current;
}

export function getJourneyLevelProgress(points: number): JourneyLevelProgress {
  const p = clampPoints(points);
  const current = resolveRankFromPoints(p);
  const next = JOURNEY_RANKS.find((r) => r.level === current.level + 1) ?? null;

  if (!next) {
    return {
      level: current.level,
      rankTitleAr: current.titleAr,
      rankTitleEn: current.titleEn,
      levelProgressPercent: 100,
      points: p,
      pointsInLevel: Math.max(0, p - current.minPoints),
      pointsToNextLevel: 0,
      nextLevel: null,
      nextRankTitleAr: null,
      nextRankTitleEn: null,
      isMaxLevel: true,
    };
  }

  const span = Math.max(1, next.minPoints - current.minPoints);
  const into = Math.min(span, Math.max(0, p - current.minPoints));
  return {
    level: current.level,
    rankTitleAr: current.titleAr,
    rankTitleEn: current.titleEn,
    levelProgressPercent: Math.round((into / span) * 100),
    points: p,
    pointsInLevel: into,
    pointsToNextLevel: Math.max(0, next.minPoints - p),
    nextLevel: next.level,
    nextRankTitleAr: next.titleAr,
    nextRankTitleEn: next.titleEn,
    isMaxLevel: false,
  };
}

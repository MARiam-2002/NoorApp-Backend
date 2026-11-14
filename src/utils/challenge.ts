import type { ChallengeType, PrayerName } from '@prisma/client';

type JourneySnapshot = {
  quranPagesRead: number;
  adhkarCompleted: boolean;
  sadaqahAmount: unknown;
};

export function isDailyChallengeCompleted(
  type: ChallengeType,
  targetValue: number,
  journey: JourneySnapshot,
  completedPrayers: PrayerName[] = [],
): boolean {
  switch (type) {
    case 'QURAN_PAGES':
      return journey.quranPagesRead >= targetValue;
    case 'ADHKAR':
      return journey.adhkarCompleted;
    case 'SADAQAH':
      return false; // Charity is never scored or rewarded based on monetary entries.
    case 'PRAYER':
      return completedPrayers.length >= targetValue;
    default:
      return false;
  }
}

export type DailyChallengeUnit = 'PAGES' | 'PRAYERS' | 'WIRD' | 'NONE';

const UNIT_LABELS: Record<DailyChallengeUnit, { unitAr: string; unitEn: string }> = {
  PAGES: { unitAr: 'صفحات', unitEn: 'pages' },
  PRAYERS: { unitAr: 'صلوات', unitEn: 'prayers' },
  WIRD: { unitAr: 'ورد', unitEn: 'wird' },
  NONE: { unitAr: '', unitEn: '' },
};

/**
 * What the challenge card shows: current / target in the challenge's own unit, with the same rule
 * isDailyChallengeCompleted uses. ADHKAR is one step (the daily wird, or morning + evening).
 */
export function dailyChallengeProgress(
  type: ChallengeType,
  targetValue: number,
  journey: JourneySnapshot,
  completedPrayers: PrayerName[] = [],
) {
  const completed = isDailyChallengeCompleted(type, targetValue, journey, completedPrayers);
  let unit: DailyChallengeUnit;
  let current: number;
  let target: number;
  switch (type) {
    case 'QURAN_PAGES':
      unit = 'PAGES'; target = targetValue; current = Math.min(journey.quranPagesRead, targetValue); break;
    case 'PRAYER':
      unit = 'PRAYERS'; target = targetValue; current = Math.min(new Set(completedPrayers).size, targetValue); break;
    case 'ADHKAR':
      unit = 'WIRD'; target = 1; current = journey.adhkarCompleted ? 1 : 0; break;
    default:
      unit = 'NONE'; target = targetValue; current = 0;
  }
  return { current, target, unit, ...UNIT_LABELS[unit], percent: target > 0 ? Math.round((current / target) * 100) : 0, completed };
}

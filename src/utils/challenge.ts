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

import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { getDayOfYear } from '../utils/date';
import {
  STANCE_SEED_ROWS,
  stanceSeedId,
  type StanceOptionKey,
} from '../shared/constants/stance-situations';

type DbSituation = {
  id: string;
  sortOrder: number;
  situationAr: string;
  situationEn: string | null;
  optionAAr: string;
  optionBAr: string;
  optionCAr: string;
  correctOptionKey: string;
  rulingAr: string;
  rulingEn: string | null;
  sourceAr: string;
  rewardPoints: number;
};

export type StancePublicOption = {
  key: StanceOptionKey;
  textAr: string;
};

export type StanceCardPublic = {
  id: string;
  sortOrder: number;
  catalogSize: number;
  labelAr: string;
  situationAr: string;
  situationEn?: string | null;
  options: StancePublicOption[];
  nextId: string;
  prevId: string;
  rewardPoints: number;
  alreadyAnswered: boolean;
  selectedOptionKey: StanceOptionKey | null;
};

export type StanceReveal = {
  correctOptionKey: StanceOptionKey;
  isCorrect: boolean;
  rulingAr: string;
  rulingEn?: string | null;
  sourceAr: string;
  pointsAwarded: number;
  selectedOptionKey: StanceOptionKey;
};

async function loadActiveSituations(): Promise<DbSituation[]> {
  const rows = await prisma.stanceSituation.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (rows.length > 0) return rows;

  // Fallback before seed runs — still sourced catalog.
  return STANCE_SEED_ROWS.map((r) => ({
    id: stanceSeedId(r.sortOrder),
    sortOrder: r.sortOrder,
    situationAr: r.situationAr,
    situationEn: null,
    optionAAr: r.optionAAr,
    optionBAr: r.optionBAr,
    optionCAr: r.optionCAr,
    correctOptionKey: r.correctOptionKey,
    rulingAr: r.rulingAr,
    rulingEn: null,
    sourceAr: r.sourceAr,
    rewardPoints: r.rewardPoints ?? 15,
  }));
}

function indexOfId(all: DbSituation[], id: string): number {
  return all.findIndex((x) => x.id === id);
}

function neighborIds(all: DbSituation[], id: string): { nextId: string; prevId: string } {
  if (all.length === 0) return { nextId: id, prevId: id };
  const i = indexOfId(all, id);
  const idx = i < 0 ? 0 : i;
  const next = all[(idx + 1) % all.length]!;
  const prev = all[(idx - 1 + all.length) % all.length]!;
  return { nextId: next.id, prevId: prev.id };
}

function toPublicCard(
  situation: DbSituation,
  all: DbSituation[],
  answered?: { selectedOptionKey: string } | null,
  labelAr = 'موقف اليوم',
): StanceCardPublic {
  const { nextId, prevId } = neighborIds(all, situation.id);
  return {
    id: situation.id,
    sortOrder: situation.sortOrder,
    catalogSize: all.length,
    labelAr,
    situationAr: situation.situationAr,
    situationEn: situation.situationEn,
    options: [
      { key: 'A', textAr: situation.optionAAr },
      { key: 'B', textAr: situation.optionBAr },
      { key: 'C', textAr: situation.optionCAr },
    ],
    nextId,
    prevId,
    rewardPoints: situation.rewardPoints,
    alreadyAnswered: Boolean(answered),
    selectedOptionKey: (answered?.selectedOptionKey as StanceOptionKey) ?? null,
  };
}

function toReveal(
  situation: DbSituation,
  selectedOptionKey: StanceOptionKey,
  isCorrect: boolean,
  pointsAwarded: number,
): StanceReveal {
  return {
    correctOptionKey: situation.correctOptionKey as StanceOptionKey,
    isCorrect,
    rulingAr: situation.rulingAr,
    rulingEn: situation.rulingEn,
    sourceAr: situation.sourceAr,
    pointsAwarded,
    selectedOptionKey,
  };
}

async function findAnswer(userId: string | undefined, situationId: string) {
  if (!userId) return null;
  return prisma.stanceAnswer.findUnique({
    where: { userId_situationId: { userId, situationId } },
  });
}

async function buildPayload(
  situation: DbSituation,
  all: DbSituation[],
  userId: string | undefined,
  opts: { isToday: boolean; dayOfYear: number | null; labelAr: string },
) {
  const answered = await findAnswer(userId, situation.id);
  const card = toPublicCard(situation, all, answered, opts.labelAr);
  // Prefer unanswered queue for nextId when logged in
  if (userId) {
    const nextUnanswered = await resolveNextUnanswered(userId, all, situation.id);
    card.nextId = nextUnanswered.id;
  }
  let reveal: StanceReveal | null = null;
  if (answered) {
    reveal = toReveal(
      situation,
      answered.selectedOptionKey as StanceOptionKey,
      answered.isCorrect,
      answered.pointsAwarded,
    );
  }
  return {
    dayOfYear: opts.dayOfYear,
    isToday: opts.isToday,
    situation: card,
    reveal,
    rulingTitleAr: 'الرأي الشرعي والأصح',
    nextCtaAr: 'الموقف التالي',
    contentPolicyAr:
      'محتوى تعليمي بمراجع من القرآن والسنة؛ ليس بديلاً عن فتوى شخصية لحالتك.',
  };
}

/**
 * Consecutive "الموقف التالي": prefer unanswered after current, then any unanswered,
 * then wrap sequential (guest = sequential only).
 */
async function resolveNextUnanswered(
  userId: string,
  all: DbSituation[],
  afterId: string,
): Promise<DbSituation> {
  const answered = await prisma.stanceAnswer.findMany({
    where: { userId },
    select: { situationId: true },
  });
  const done = new Set(answered.map((a) => a.situationId));
  const start = indexOfId(all, afterId);
  const startIdx = start < 0 ? 0 : start;

  for (let step = 1; step <= all.length; step += 1) {
    const cand = all[(startIdx + step) % all.length]!;
    if (!done.has(cand.id)) return cand;
  }
  // All answered → sequential next
  return all[(startIdx + 1) % all.length]!;
}

export async function getTodayStance(userId?: string, dayOfYear = getDayOfYear()) {
  const all = await loadActiveSituations();
  if (all.length === 0) {
    throw new AppError('Stance catalog is empty', HttpStatus.SERVICE_UNAVAILABLE, ErrorCodes.INTERNAL_SERVER_ERROR);
  }
  const idx = (Math.max(1, Math.floor(dayOfYear)) - 1) % all.length;
  const situation = all[idx]!;
  return buildPayload(situation, all, userId, {
    isToday: true,
    dayOfYear,
    labelAr: 'موقف اليوم',
  });
}

export async function getStanceByIdForUser(situationId: string, userId?: string) {
  const all = await loadActiveSituations();
  const situation = all.find((x) => x.id === situationId);
  if (!situation) {
    throw new AppError('Stance situation not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }
  return buildPayload(situation, all, userId, {
    isToday: false,
    dayOfYear: null,
    labelAr: 'الموقف',
  });
}

export async function getNextStanceForUser(afterId: string, userId?: string) {
  const all = await loadActiveSituations();
  if (all.length === 0) {
    throw new AppError('Stance catalog is empty', HttpStatus.SERVICE_UNAVAILABLE, ErrorCodes.INTERNAL_SERVER_ERROR);
  }
  if (!afterId?.trim()) {
    return getTodayStance(userId);
  }
  const next = userId
    ? await resolveNextUnanswered(userId, all, afterId)
    : (() => {
        const i = indexOfId(all, afterId);
        const idx = i < 0 ? 0 : i;
        return all[(idx + 1) % all.length]!;
      })();
  return buildPayload(next, all, userId, {
    isToday: false,
    dayOfYear: null,
    labelAr: 'الموقف',
  });
}

export async function listStanceCatalogLite() {
  const all = await loadActiveSituations();
  return {
    count: all.length,
    items: all.map((s) => ({
      id: s.id,
      sortOrder: s.sortOrder,
      situationAr: s.situationAr,
      sourceAr: s.sourceAr,
    })),
  };
}

export async function answerStance(input: {
  userId?: string;
  situationId: string;
  selectedOptionKey: string;
}) {
  const all = await loadActiveSituations();
  const situation = all.find((x) => x.id === input.situationId);
  if (!situation) {
    throw new AppError('Stance situation not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }
  const key = String(input.selectedOptionKey || '').trim().toUpperCase();
  if (key !== 'A' && key !== 'B' && key !== 'C') {
    throw new AppError(
      'selectedOptionKey must be A, B, or C',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }
  const selectedOptionKey = key as StanceOptionKey;
  const isCorrect = selectedOptionKey === situation.correctOptionKey;

  let pointsAwarded = 0;
  let alreadyAnswered = false;

  if (input.userId) {
    const existing = await prisma.stanceAnswer.findUnique({
      where: {
        userId_situationId: { userId: input.userId, situationId: situation.id },
      },
    });
    if (existing) {
      alreadyAnswered = true;
      pointsAwarded = existing.pointsAwarded;
      const card = toPublicCard(situation, all, existing, 'الموقف');
      card.nextId = (await resolveNextUnanswered(input.userId, all, situation.id)).id;
      return {
        alreadyAnswered: true,
        situation: card,
        reveal: toReveal(
          situation,
          existing.selectedOptionKey as StanceOptionKey,
          existing.isCorrect,
          existing.pointsAwarded,
        ),
        nextId: card.nextId,
        rulingTitleAr: 'الرأي الشرعي والأصح',
        nextCtaAr: 'الموقف التالي',
        contentPolicyAr:
          'محتوى تعليمي بمراجع من القرآن والسنة؛ ليس بديلاً عن فتوى شخصية لحالتك.',
      };
    }

    // Only persist when catalog row exists in DB (after seed).
    const dbRow = await prisma.stanceSituation.findUnique({ where: { id: situation.id } });
    if (!dbRow) {
      throw new AppError(
        'Stance catalog not seeded yet — run seed-stances',
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCodes.INTERNAL_SERVER_ERROR,
      );
    }

    pointsAwarded = situation.rewardPoints;
    await prisma.$transaction([
      prisma.stanceAnswer.create({
        data: {
          userId: input.userId,
          situationId: situation.id,
          selectedOptionKey,
          isCorrect,
          pointsAwarded,
        },
      }),
      prisma.user.update({
        where: { id: input.userId },
        data: { points: { increment: pointsAwarded } },
      }),
    ]);
  }

  const card = toPublicCard(
    situation,
    all,
    input.userId ? { selectedOptionKey } : null,
    'الموقف',
  );
  if (input.userId) {
    card.nextId = (await resolveNextUnanswered(input.userId, all, situation.id)).id;
  }

  return {
    alreadyAnswered,
    situation: card,
    reveal: toReveal(situation, selectedOptionKey, isCorrect, pointsAwarded),
    nextId: card.nextId,
    rulingTitleAr: 'الرأي الشرعي والأصح',
    nextCtaAr: 'الموقف التالي',
    contentPolicyAr:
      'محتوى تعليمي بمراجع من القرآن والسنة؛ ليس بديلاً عن فتوى شخصية لحالتك.',
  };
}

import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { getDayOfYear } from '../utils/date';
import {
  getNextStance,
  getPrevStance,
  getStanceById,
  getStanceForDayOfYear,
  STANCE_SITUATION_COUNT,
  STANCE_SITUATIONS,
  type StanceOptionKey,
  type StanceSituation,
} from '../shared/constants/stance-situations';

export type StancePublicOption = {
  key: StanceOptionKey;
  textAr: string;
  textEn?: string;
};

/** Payload before the user answers — never includes correct key / ruling. */
export type StanceCardPublic = {
  id: string;
  sortOrder: number;
  catalogSize: number;
  labelAr: string;
  situationAr: string;
  situationEn?: string;
  options: StancePublicOption[];
  nextId: string;
  prevId: string;
  rewardPoints: number;
  alreadyAnswered: boolean;
  selectedOptionKey: StanceOptionKey | null;
};

/** After answer — includes الشرعي card. */
export type StanceReveal = {
  correctOptionKey: StanceOptionKey;
  isCorrect: boolean;
  rulingAr: string;
  rulingEn?: string;
  sourceAr?: string;
  pointsAwarded: number;
  selectedOptionKey: StanceOptionKey;
};

function toPublicCard(
  situation: StanceSituation,
  answered?: { selectedOptionKey: string } | null,
): StanceCardPublic {
  const next = getNextStance(situation.id);
  const prev = getPrevStance(situation.id);
  return {
    id: situation.id,
    sortOrder: situation.sortOrder,
    catalogSize: STANCE_SITUATION_COUNT,
    labelAr: 'موقف اليوم',
    situationAr: situation.situationAr,
    situationEn: situation.situationEn,
    options: situation.options.map((o) => ({
      key: o.key,
      textAr: o.textAr,
      textEn: o.textEn,
    })),
    nextId: next.id,
    prevId: prev.id,
    rewardPoints: situation.rewardPoints,
    alreadyAnswered: Boolean(answered),
    selectedOptionKey: (answered?.selectedOptionKey as StanceOptionKey) ?? null,
  };
}

async function findAnswer(userId: string | undefined, situationId: string) {
  if (!userId) return null;
  return prisma.stanceAnswer.findUnique({
    where: { userId_situationId: { userId, situationId } },
  });
}

export async function getTodayStance(userId?: string, dayOfYear = getDayOfYear()) {
  const situation = getStanceForDayOfYear(dayOfYear);
  const answered = await findAnswer(userId, situation.id);
  const card = toPublicCard(situation, answered);
  let reveal: StanceReveal | null = null;
  if (answered) {
    reveal = {
      correctOptionKey: situation.correctOptionKey,
      isCorrect: answered.isCorrect,
      rulingAr: situation.rulingAr,
      rulingEn: situation.rulingEn,
      sourceAr: situation.sourceAr,
      pointsAwarded: answered.pointsAwarded,
      selectedOptionKey: answered.selectedOptionKey as StanceOptionKey,
    };
  }
  return {
    dayOfYear,
    isToday: true,
    situation: card,
    reveal,
    /** Green card title for Flutter. */
    rulingTitleAr: 'الرأي الشرعي والأصح',
    nextCtaAr: 'الموقف التالي',
  };
}

export async function getStanceByIdForUser(situationId: string, userId?: string) {
  const situation = getStanceById(situationId);
  if (!situation) {
    throw new AppError('Stance situation not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }
  const answered = await findAnswer(userId, situation.id);
  const card = toPublicCard(situation, answered);
  let reveal: StanceReveal | null = null;
  if (answered) {
    reveal = {
      correctOptionKey: situation.correctOptionKey,
      isCorrect: answered.isCorrect,
      rulingAr: situation.rulingAr,
      rulingEn: situation.rulingEn,
      sourceAr: situation.sourceAr,
      pointsAwarded: answered.pointsAwarded,
      selectedOptionKey: answered.selectedOptionKey as StanceOptionKey,
    };
  }
  return {
    dayOfYear: null,
    isToday: false,
    situation: card,
    reveal,
    rulingTitleAr: 'الرأي الشرعي والأصح',
    nextCtaAr: 'الموقف التالي',
  };
}

export async function getNextStanceForUser(afterId: string, userId?: string) {
  const next = getNextStance(afterId);
  return getStanceByIdForUser(next.id, userId);
}

export async function listStanceCatalogLite() {
  return {
    count: STANCE_SITUATION_COUNT,
    items: STANCE_SITUATIONS.map((s) => ({
      id: s.id,
      sortOrder: s.sortOrder,
      situationAr: s.situationAr,
    })),
  };
}

export async function answerStance(input: {
  userId?: string;
  situationId: string;
  selectedOptionKey: string;
}) {
  const situation = getStanceById(input.situationId);
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
      return {
        alreadyAnswered: true,
        situation: toPublicCard(situation, existing),
        reveal: {
          correctOptionKey: situation.correctOptionKey,
          isCorrect: existing.isCorrect,
          rulingAr: situation.rulingAr,
          rulingEn: situation.rulingEn,
          sourceAr: situation.sourceAr,
          pointsAwarded: existing.pointsAwarded,
          selectedOptionKey: existing.selectedOptionKey as StanceOptionKey,
        } satisfies StanceReveal,
        nextId: getNextStance(situation.id).id,
        rulingTitleAr: 'الرأي الشرعي والأصح',
        nextCtaAr: 'الموقف التالي',
      };
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

  return {
    alreadyAnswered,
    situation: toPublicCard(situation, input.userId ? { selectedOptionKey } : null),
    reveal: {
      correctOptionKey: situation.correctOptionKey,
      isCorrect,
      rulingAr: situation.rulingAr,
      rulingEn: situation.rulingEn,
      sourceAr: situation.sourceAr,
      pointsAwarded,
      selectedOptionKey,
    } satisfies StanceReveal,
    nextId: getNextStance(situation.id).id,
    rulingTitleAr: 'الرأي الشرعي والأصح',
    nextCtaAr: 'الموقف التالي',
  };
}

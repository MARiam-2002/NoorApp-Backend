import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { calculateZakat, calculationSchema, currencyDigits, zakatSettlement, type ZakatCalculationInput } from '../shared/utils/zakat';
import { getLocalClock, resolveTimezone } from './salawat-reminder.service';
import { assessWithMetalQuote } from './metal-prices.service';

export const charityExperience = {
  version: 2, sadaqahMode: 'REMINDER_ONLY', legacySadaqahTrackingDeprecated: true,
  homeTile: 'ZAKAT', dailyJourneyCategories: ['PRAYER', 'QURAN', 'ADHKAR'],
  financialAmountsHiddenByDefault: true, zakatCountsTowardDailyJourney: false,
  sadaqahAwardsPoints: false, zakatAwardsPoints: false,
};
const invalid = (message: string) => new AppError(message, HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
const conflict = () => new AppError('Request key already used with different data', HttpStatus.CONFLICT, ErrorCodes.VALIDATION_ERROR);
const missing = () => new AppError('Zakat cycle not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  return JSON.stringify(value);
};
async function assertNotFuture(userId: string, date: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  if (date > getLocalClock(new Date(), resolveTimezone(user?.timezone)).dayKey) throw invalid('Future assessment/payment dates cannot be recorded as completed');
}

export async function getZakatCycle(userId: string, cycleId: string) {
  const row = await prisma.zakatCycle.findFirst({ where: { id: cycleId, userId } });
  if (!row) throw missing();
  const aggregate = await prisma.zakatPayment.aggregate({ where: { cycleId }, _sum: { amount: true } });
  return { id: row.id, currency: row.currency, dueDate: row.dueDate.toISOString().slice(0, 10),
    assessment: row.assessment, createdAt: row.createdAt.toISOString(),
    ...zakatSettlement(row.dueAmount, aggregate._sum.amount ?? 0, row.currency) };
}
export async function getZakatSummary(userId: string) {
  const latest = await prisma.zakatCycle.findFirst({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } });
  return { experience: charityExperience, state: latest ? 'ASSESSED' : 'NOT_CALCULATED',
    latestCycle: latest ? await getZakatCycle(userId, latest.id) : null };
}
export async function getZakatHomeTile(userId: string) {
  try {
    const summary = await getZakatSummary(userId);
    return { ...summary, labelAr: 'الزكاة', labelEn: 'Zakat', deepLink: '/zakat', hideAmountsByDefault: true, countsTowardDailyJourney: false };
  } catch {
    // Never turn a missing migration / database outage into a false zero-liability claim.
    return { state: 'UNAVAILABLE', latestCycle: null, labelAr: 'الزكاة', labelEn: 'Zakat', deepLink: '/zakat', hideAmountsByDefault: true, countsTowardDailyJourney: false };
  }
}
export async function saveZakatCycle(userId: string, input: { requestKey: string; dueDate: string; calculation: ZakatCalculationInput }) {
  await assertNotFuture(userId, input.dueDate);
  const calculation = calculationSchema.parse(input.calculation);
  const requestFingerprint = createHash('sha256').update(canonical({ dueDate: input.dueDate, calculation })).digest('hex');
  const existing = await prisma.zakatCycle.findUnique({ where: { userId_requestKey: { userId, requestKey: input.requestKey } } });
  if (existing) {
    if ((existing.assessment as { requestFingerprint?: string }).requestFingerprint !== requestFingerprint) throw conflict();
    return getZakatCycle(userId, existing.id);
  }
  const assessment = { ...assessWithMetalQuote(calculation), requestFingerprint };
  if (assessment.status !== 'DUE' || new Prisma.Decimal(assessment.dueAmount).lte(0)) throw invalid('Only a current-price assessment with confirmed completed lunar hawl and positive due amount can be saved');
  if (input.dueDate !== input.calculation.asOfDate) throw invalid('Due date must match the assessment date. Recalculate wealth at its actual lunar anniversary');
  const dueDate = new Date(`${input.dueDate}T12:00:00Z`);
  try {
    const row = await prisma.zakatCycle.create({ data: { userId, requestKey: input.requestKey, currency: assessment.currency, dueDate, dueAmount: assessment.dueAmount, assessment: assessment as Prisma.InputJsonValue } });
    return getZakatCycle(userId, row.id);
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error;
    return saveZakatCycle(userId, input);
  }
}
export async function recordZakatPayment(userId: string, cycleId: string, input: { requestKey: string; amount: string; paidOn: string; currency: string }) {
  const row = await prisma.zakatCycle.findFirst({ where: { id: cycleId, userId } });
  if (!row) throw missing();
  await assertNotFuture(userId, input.paidOn);
  if (input.paidOn < row.dueDate.toISOString().slice(0, 10)) throw invalid('This ledger records payments on or after the assessed due date; advance payments require separate scholarly review');
  if (input.currency !== row.currency) throw invalid('Payment currency must match the cycle');
  const amount = new Prisma.Decimal(input.amount);
  if (amount.lte(0) || amount.decimalPlaces() > currencyDigits(row.currency)) throw invalid('Payment must be positive and use the currency minor-unit precision');
  const existing = await prisma.zakatPayment.findUnique({ where: { cycleId_requestKey: { cycleId, requestKey: input.requestKey } } });
  if (existing) {
    if (!existing.amount.eq(amount) || existing.paidOn.toISOString().slice(0, 10) !== input.paidOn) throw conflict();
    return { paymentId: existing.id, cycle: await getZakatCycle(userId, cycleId) };
  }
  try {
    const payment = await prisma.zakatPayment.create({ data: { cycleId, requestKey: input.requestKey, amount, paidOn: new Date(`${input.paidOn}T12:00:00Z`) } });
    return { paymentId: payment.id, cycle: await getZakatCycle(userId, cycleId) };
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error;
    return recordZakatPayment(userId, cycleId, input);
  }
}
export async function deleteZakatPayment(userId: string, cycleId: string, paymentId: string) {
  const cycle = await prisma.zakatCycle.findFirst({ where: { id: cycleId, userId }, select: { id: true } });
  if (!cycle) throw missing();
  // Scoped deletion is retry-safe; users can correct a mistaken private ledger entry.
  await prisma.zakatPayment.deleteMany({ where: { id: paymentId, cycleId } });
  return getZakatCycle(userId, cycleId);
}
export async function deleteZakatCycle(userId: string, cycleId: string) {
  const deleted = await prisma.zakatCycle.deleteMany({ where: { id: cycleId, userId } });
  return { deleted: deleted.count > 0 };
}

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/common';
import { validate } from '../lib/validation';
import { sendSuccess } from '../shared/utils/response';
import { calculationSchema, calculateZakat, amountSchema, dateSchema, currencySchema, ZAKAT_REFERENCES } from '../shared/utils/zakat';
import { charityExperience, getZakatSummary, getZakatCycle, saveZakatCycle, recordZakatPayment, deleteZakatPayment, deleteZakatCycle } from '../services/zakat.service';
import { getCharityReminder, updateCharityReminder } from '../services/charity-reminder.service';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { env, ErrorCodes, HttpStatus } from '../config';
import { getMetalQuote, metalQuoteQuery, assessWithMetalQuote } from '../services/metal-prices.service';

export const zakatRouter = Router();
export const charityRouter = Router();
const requestKey = z.string().uuid();
const cycleParams = z.object({ cycleId: z.string().uuid() });
const paymentParams = cycleParams.extend({ paymentId: z.string().uuid() });
const pageSchema = z.object({ cursor: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
export const saveCycleSchema = z.object({ requestKey, dueDate: dateSchema, calculation: calculationSchema }).strict();
export const paymentSchema = z.object({ requestKey, amount: amountSchema, paidOn: dateSchema, currency: currencySchema }).strict();
export const charityPreferenceSchema = z.object({ enabled: z.boolean().optional(), localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(values => new Set(values).size === values.length, 'Weekdays must be unique').optional(),
  language: z.enum(['ar', 'en']).optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one preference is required');
const noStore: import('express').RequestHandler = (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); };
zakatRouter.use(noStore);
charityRouter.use(noStore, authenticate);
zakatRouter.get('/config', (_req, res) => sendSuccess(res, {
  experience: charityExperience, references: Object.entries(ZAKAT_REFERENCES).map(([id, reference]) => ({ id, ...reference })),
  defaultNisabBasis: null, rate: '0.025', calendar: 'HIJRI_LUNAR', priceMode: 'LIVE_SIGNED_QUOTE',
  priceProvider: 'Metals.dev', priceProviderConfigured: Boolean(env.METALS_DEV_API_KEY), manualPricesAllowed: env.ZAKAT_ALLOW_MANUAL_PRICES,
  cacheTtlSeconds: env.METALS_CACHE_TTL_SECONDS, savesAssetBreakdown: false, monthlyObligation: false,
}, 'Zakat calculator configuration', _req));
zakatRouter.get('/metal-prices', validate(metalQuoteQuery, 'query'), asyncHandler(async (req, res) => { sendSuccess(res, await getMetalQuote(metalQuoteQuery.parse(req.query)), 'Verified metal-price quote', req); }));
zakatRouter.post('/calculate', validate(calculationSchema), asyncHandler(async (req, res) => { sendSuccess(res, assessWithMetalQuote(req.body), 'Zakat estimate calculated; no financial data saved', req); }));
zakatRouter.use(authenticate);
zakatRouter.get('/summary', asyncHandler(async (req, res) => { sendSuccess(res, await getZakatSummary(req.user!.sub), 'Private Zakat summary', req); }));
zakatRouter.get('/cycles', validate(pageSchema, 'query'), asyncHandler(async (req, res) => {
  const { cursor, limit } = pageSchema.parse(req.query);
  if (cursor) await getZakatCycle(req.user!.sub, cursor);
  const rows = await prisma.zakatCycle.findMany({ where: { userId: req.user!.sub }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  const page = rows.slice(0, limit);
  sendSuccess(res, { items: await Promise.all(page.map(row => getZakatCycle(req.user!.sub, row.id))), nextCursor: rows.length > limit ? page[page.length - 1]!.id : null }, 'Private Zakat cycles', req);
}));
zakatRouter.post('/cycles', validate(saveCycleSchema), asyncHandler(async (req, res) => { sendSuccess(res, await saveZakatCycle(req.user!.sub, req.body), 'Zakat assessment saved', req); }));
zakatRouter.get('/cycles/:cycleId', validate(cycleParams, 'params'), asyncHandler(async (req, res) => { sendSuccess(res, await getZakatCycle(req.user!.sub, String(req.params.cycleId)), 'Private Zakat cycle', req); }));
zakatRouter.delete('/cycles/:cycleId', validate(cycleParams, 'params'), asyncHandler(async (req, res) => { sendSuccess(res, await deleteZakatCycle(req.user!.sub, String(req.params.cycleId)), 'Private Zakat cycle deleted', req); }));
zakatRouter.get('/cycles/:cycleId/payments', validate(cycleParams, 'params'), validate(pageSchema, 'query'), asyncHandler(async (req, res) => {
  const cycleId = String(req.params.cycleId);
  await getZakatCycle(req.user!.sub, cycleId);
  const { cursor, limit } = pageSchema.parse(req.query);
  if (cursor && !await prisma.zakatPayment.findFirst({ where: { id: cursor, cycleId }, select: { id: true } })) throw new AppError('Payment cursor not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  const rows = await prisma.zakatPayment.findMany({ where: { cycleId }, orderBy: [{ paidOn: 'desc' }, { id: 'desc' }], take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  const page = rows.slice(0, limit);
  sendSuccess(res, { items: page.map(row => ({ id: row.id, amount: row.amount.toString(), paidOn: row.paidOn.toISOString().slice(0, 10), createdAt: row.createdAt.toISOString() })), nextCursor: rows.length > limit ? page[page.length - 1]!.id : null }, 'User-reported payments', req);
}));
zakatRouter.post('/cycles/:cycleId/payments', validate(cycleParams, 'params'), validate(paymentSchema), asyncHandler(async (req, res) => { sendSuccess(res, await recordZakatPayment(req.user!.sub, String(req.params.cycleId), req.body), 'User-reported payment recorded', req); }));
zakatRouter.delete('/cycles/:cycleId/payments/:paymentId', validate(paymentParams, 'params'), asyncHandler(async (req, res) => { sendSuccess(res, await deleteZakatPayment(req.user!.sub, String(req.params.cycleId), String(req.params.paymentId)), 'Private payment entry removed', req); }));
charityRouter.get('/reminder-preferences', asyncHandler(async (req, res) => { sendSuccess(res, await getCharityReminder(req.user!.sub), 'Charity reminder preferences', req); }));
charityRouter.patch('/reminder-preferences', validate(charityPreferenceSchema), asyncHandler(async (req, res) => { sendSuccess(res, await updateCharityReminder(req.user!.sub, req.body), 'Charity reminder preferences updated', req); }));

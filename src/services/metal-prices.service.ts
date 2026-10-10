import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { env, ErrorCodes } from '../config';
import { AppError } from '../lib/errors';
import { calculationSchema, calculateZakat, currencySchema, dateSchema, ZAKAT_REFERENCES, type ZakatCalculationInput } from '../shared/utils/zakat';

const basisSchema = z.enum(['GOLD_24K_85G', 'EGYPT_GOLD_21K_85G', 'SILVER_999_595G']);
export const metalQuoteQuery = z.object({ currency: currencySchema, nisabBasis: basisSchema,
  timezone: z.string().max(100).default('UTC').refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Invalid IANA timezone') }).strict();
const positive = z.number().finite().positive();
const providerTimestamp = z.string().datetime({ offset: true });
const snapshotSchema = z.object({ status: z.literal('success'), currency: z.literal('USD'), unit: z.literal('g'),
  timestamp: providerTimestamp.optional(), timestamps: z.object({ metal: providerTimestamp, currency: providerTimestamp }).optional(),
  metals: z.object({ gold: positive, silver: positive }), currencies: z.record(z.string(), positive),
}).refine(value => Boolean(value.timestamps || value.timestamp), 'Provider collection timestamps are required').transform(value => {
  const metalAsOfUtc = value.timestamps?.metal ?? value.timestamp!;
  const currencyAsOfUtc = value.timestamps?.currency ?? value.timestamp!;
  return { ...value, metalAsOfUtc, currencyAsOfUtc,
    timestamp: Date.parse(metalAsOfUtc) <= Date.parse(currencyAsOfUtc) ? metalAsOfUtc : currencyAsOfUtc };
});
type Snapshot = z.infer<typeof snapshotSchema>;
let cached: { snapshot: Snapshot; fetchedAt: number } | undefined;
let pending: Promise<Snapshot> | undefined;
let retryAfter = 0;
const unavailable = () => new AppError('Metal prices are temporarily unavailable; retry later. No estimated or manual fallback is applied.', 503, ErrorCodes.METAL_PRICES_UNAVAILABLE);
const invalid = () => new AppError('Invalid, changed or expired metal quote. Request a new quote and recalculate.', 400, ErrorCodes.VALIDATION_ERROR);
function fresh(snapshot: Snapshot, now: number) {
  return [snapshot.timestamp, snapshot.metalAsOfUtc, snapshot.currencyAsOfUtc].filter(Boolean).every(value => {
    const age = now - Date.parse(value);
    return age >= -60000 && age <= env.METALS_MAX_AGE_SECONDS * 1000;
  });
}
async function getSnapshot(): Promise<Snapshot> {
  if (!env.METALS_DEV_API_KEY) throw unavailable();
  const now = Date.now();
  if (cached && now - cached.fetchedAt < env.METALS_CACHE_TTL_SECONDS * 1000 && fresh(cached.snapshot, now)) return cached.snapshot;
  if (pending) return pending;
  if (now < retryAfter) throw unavailable();
  pending = (async () => {
    try {
      const url = new URL('https://api.metals.dev/v1/latest');
      url.search = new URLSearchParams({ api_key: env.METALS_DEV_API_KEY, currency: 'USD', unit: 'g' }).toString();
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(env.METALS_REQUEST_TIMEOUT_MS), redirect: 'error' });
      if (!response.ok) throw unavailable();
      const snapshot = snapshotSchema.parse(await response.json());
      if (!fresh(snapshot, Date.now())) throw unavailable();
      cached = { snapshot, fetchedAt: Date.now() };
      return snapshot;
    } catch {
      // Never log upstream errors/URLs: authentication is a secret query parameter.
      retryAfter = Date.now() + 60000;
      throw unavailable();
    } finally { pending = undefined; }
  })();
  return pending;
}
const receiptSchema = z.object({ purpose: z.literal('NOOR_METAL_QUOTE_V1'), currency: currencySchema, nisabBasis: basisSchema,
  pricePerGram: z.string(), priceAsOfDate: dateSchema, priceSource: z.literal('Metals.dev international spot benchmark'),
  asOfUtc: providerTimestamp, metalAsOfUtc: providerTimestamp, currencyAsOfUtc: providerTimestamp,
  fetchedAtUtc: z.string().datetime(), expiresAt: z.number().int(), timezone: z.string() }).strict();
const signature = (body: string) => createHmac('sha256', env.JWT_SECRET).update('noor:metal-quote:v1:').update(body).digest();
function encode(value: z.infer<typeof receiptSchema>) {
  const body = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${body}.${signature(body).toString('base64url')}`;
}
export async function getMetalQuote(raw: z.infer<typeof metalQuoteQuery>) {
  const input = metalQuoteQuery.parse(raw), snapshot = await getSnapshot();
  // Provider FX values represent USD per one target currency (not target units per USD).
  const rate = input.currency === 'USD' ? 1 : snapshot.currencies[input.currency];
  if (!rate) throw new AppError('Currency is not available from the metal-price provider', 400, ErrorCodes.VALIDATION_ERROR);
  const basis = ZAKAT_REFERENCES[input.nisabBasis];
  const metal = basis.metal === 'silver999' ? snapshot.metals.silver : snapshot.metals.gold;
  const purity = basis.metal === 'gold21k' ? new Prisma.Decimal(21).div(24) : new Prisma.Decimal(1);
  const pricePerGram = new Prisma.Decimal(metal).div(rate).mul(purity).toFixed(6);
  if (new Prisma.Decimal(pricePerGram).lte(0)) throw unavailable();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: input.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  const receipt = receiptSchema.parse({ purpose: 'NOOR_METAL_QUOTE_V1', ...input, pricePerGram,
    priceAsOfDate: date, priceSource: 'Metals.dev international spot benchmark', asOfUtc: snapshot.timestamp,
    metalAsOfUtc: snapshot.metalAsOfUtc, currencyAsOfUtc: snapshot.currencyAsOfUtc,
    fetchedAtUtc: new Date(cached!.fetchedAt).toISOString(), expiresAt: Math.min(Date.now() + 600000, Date.parse(snapshot.timestamp) + env.METALS_MAX_AGE_SECONDS * 1000) });
  return { ...receipt, quoteToken: encode(receipt), asOfDate: date, unit: 'g', verifiedByBackend: true,
    priceType: 'INTERNATIONAL_SPOT', derivedPurity: basis.metal === 'gold21k', supportedCurrencies: [...new Set(['USD', ...Object.keys(snapshot.currencies).filter(v => currencySchema.safeParse(v).success)])].sort(),
    notice: 'International spot benchmark converted to your currency. Local dealer premiums, taxes and making charges are excluded.' };
}
export function assessWithMetalQuote(raw: ZakatCalculationInput) {
  const input = calculationSchema.parse(raw);
  if (!input.quoteToken) {
    if (!env.ZAKAT_ALLOW_MANUAL_PRICES) throw invalid();
    return calculateZakat(input);
  }
  try {
    const [body, sig, extra] = input.quoteToken.split('.');
    if (!body || !sig || extra) throw invalid();
    const actual = Buffer.from(sig, 'base64url'), expected = signature(body);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();
    const quote = receiptSchema.parse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
    if (Date.now() >= quote.expiresAt || !fresh({ timestamp: quote.asOfUtc, metalAsOfUtc: quote.metalAsOfUtc, currencyAsOfUtc: quote.currencyAsOfUtc } as Snapshot, Date.now())) throw invalid();
    for (const key of ['currency', 'nisabBasis', 'pricePerGram', 'priceAsOfDate', 'priceSource'] as const) if (input[key] !== quote[key]) throw invalid();
    if (input.asOfDate !== quote.priceAsOfDate) throw invalid();
    return { ...calculateZakat(input), quote: { pricePerGram: quote.pricePerGram, asOfDate: quote.priceAsOfDate,
      source: quote.priceSource, verifiedByBackend: true, isCurrent: true, asOfUtc: quote.asOfUtc,
      metalAsOfUtc: quote.metalAsOfUtc, currencyAsOfUtc: quote.currencyAsOfUtc,
      fetchedAtUtc: quote.fetchedAtUtc, expiresAtUtc: new Date(quote.expiresAt).toISOString(), priceType: 'INTERNATIONAL_SPOT', timezone: quote.timezone } };
  } catch { throw invalid(); }
}

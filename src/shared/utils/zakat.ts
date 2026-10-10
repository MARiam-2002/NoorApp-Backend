import { Prisma } from '@prisma/client';
import { z } from 'zod';

export const ZAKAT_REFERENCES = {
  GOLD_24K_85G: { grams: '85', metal: 'gold24k', title: '85 grams of pure gold', source: 'https://zatca.gov.sa/en/HelpCenter/guidelines/Documents/Zakat_Individual.pdf' },
  EGYPT_GOLD_21K_85G: { grams: '85', metal: 'gold21k', title: 'Egyptian Dar al-Ifta: 85 grams of 21-karat gold', source: 'https://www.dar-alifta.org/ar/fatwa/details/13922/حكم-تعجيل-زكاة-المال' },
  SILVER_999_595G: { grams: '595', metal: 'silver999', title: '595 grams of pure silver', source: 'https://zatca.gov.sa/en/HelpCenter/guidelines/Documents/Zakat_Individual.pdf' },
} as const;

// String amounts prevent binary floating-point errors and accidental currency coercion.
export const amountSchema = z.string().regex(/^(0|[1-9]\d{0,14})(\.\d{1,6})?$/, 'Use a non-negative decimal string with at most 6 decimal places');
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const supportedCurrencies = new Set(Intl.supportedValuesOf('currency'));
export const currencySchema = z.string().regex(/^[A-Z]{3}$/).refine(value => supportedCurrencies.has(value), 'Unsupported ISO currency');
export const calculationSchema = z.object({
  quoteToken: z.string().max(4096).optional(),
  currency: currencySchema,
  asOfDate: dateSchema,
  nisabBasis: z.enum(['GOLD_24K_85G', 'EGYPT_GOLD_21K_85G', 'SILVER_999_595G']),
  pricePerGram: amountSchema.refine(value => new Prisma.Decimal(value).gt(0), 'Price must be positive'),
  priceAsOfDate: dateSchema,
  priceSource: z.string().trim().min(2).max(160),
  hawlCompleted: z.boolean(),
  assets: z.object({
    cash: amountSchema.default('0'), bankBalances: amountSchema.default('0'),
    zakatableGoldValue: amountSchema.default('0'), zakatableSilverValue: amountSchema.default('0'),
    tradeInventory: amountSchema.default('0'), zakatableInvestments: amountSchema.default('0'),
    collectibleReceivables: amountSchema.default('0'),
  }).strict(),
  deductibleLiabilities: amountSchema.default('0'),
  deductionsConfirmed: z.boolean().default(false),
}).strict().superRefine((value, ctx) => {
  if (value.priceAsOfDate > value.asOfDate) ctx.addIssue({ code: 'custom', path: ['priceAsOfDate'], message: 'Quote date cannot follow assessment date' });
  if (new Prisma.Decimal(value.deductibleLiabilities).gt(0) && !value.deductionsConfirmed) ctx.addIssue({ code: 'custom', path: ['deductionsConfirmed'], message: 'Confirm that deductions qualify under your chosen scholarly guidance' });
});
export type ZakatCalculationInput = z.infer<typeof calculationSchema>;
export function currencyDigits(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits!;
}
export function calculateZakat(raw: ZakatCalculationInput) {
  const input = calculationSchema.parse(raw);
  const digits = currencyDigits(input.currency);
  const format = (value: Prisma.Decimal) => value.toFixed(digits, Prisma.Decimal.ROUND_HALF_UP);
  const gross = Object.values(input.assets).reduce((sum, value) => sum.add(value), new Prisma.Decimal(0));
  const net = Prisma.Decimal.max(0, gross.sub(input.deductibleLiabilities));
  const basis = ZAKAT_REFERENCES[input.nisabBasis];
  const nisab = new Prisma.Decimal(input.pricePerGram).mul(basis.grams);
  const meetsNisab = net.gte(nisab);
  const estimate = meetsNisab ? net.mul('0.025') : new Prisma.Decimal(0);
  const quoteIsCurrent = input.priceAsOfDate === input.asOfDate;
  const status = !quoteIsCurrent ? 'QUOTE_STALE' : !meetsNisab ? 'BELOW_NISAB' : !input.hawlCompleted ? 'HAWL_PENDING' : 'DUE';
  return {
    version: 1, currency: input.currency, minorUnitDigits: digits, asOfDate: input.asOfDate,
    status, grossAssets: format(gross), deductibleLiabilities: format(new Prisma.Decimal(input.deductibleLiabilities)),
    netZakatableAssets: format(net), nisabAmount: format(nisab), meetsNisab,
    rate: '0.025', calendar: 'HIJRI_LUNAR', hawlCompleted: input.hawlCompleted,
    estimatedZakat: format(estimate), dueAmount: format(status === 'DUE' ? estimate : new Prisma.Decimal(0)),
    monthlySavingSuggestion: format(estimate.div(12)), monthlySuggestionIsObligation: false,
    quote: { pricePerGram: input.pricePerGram, asOfDate: input.priceAsOfDate, source: input.priceSource, verifiedByBackend: false, isCurrent: quoteIsCurrent },
    reference: { id: input.nisabBasis, ...basis },
    notice: 'General monetary-wealth estimate based on your inputs and confirmed lunar hawl. Personal-use assets are excluded. Jewelry, investments, receivables and deductions require appropriate scholarly guidance. Asset inputs must already use the selected currency. Payments are user-reported and unverified.',
  };
}

export function zakatSettlement(due: Prisma.Decimal.Value, paid: Prisma.Decimal.Value, currency: string) {
  const amount = new Prisma.Decimal(due), payments = new Prisma.Decimal(paid);
  const format = (value: Prisma.Decimal) => value.toFixed(currencyDigits(currency), Prisma.Decimal.ROUND_HALF_UP);
  return { dueAmount: format(amount), recordedPaidAmount: format(payments), remainingAmount: format(Prisma.Decimal.max(0, amount.sub(payments))),
    excessRecordedAmount: format(Prisma.Decimal.max(0, payments.sub(amount))),
    paidPercent: amount.gt(0) ? Math.min(100, payments.div(amount).mul(100).toDecimalPlaces(2).toNumber()) : 0,
    paymentVerification: 'USER_REPORTED', countsTowardDailyJourney: false, awardsPoints: false };
}

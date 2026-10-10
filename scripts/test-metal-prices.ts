import assert from 'node:assert/strict';
import { env } from '../src/config';
import { getMetalQuote, assessWithMetalQuote } from '../src/services/metal-prices.service';
import { calculationSchema } from '../src/shared/utils/zakat';

async function main() {
  const originalFetch = globalThis.fetch, originalNow = Date.now;
  const originalKey = env.METALS_DEV_API_KEY;
  env.ZAKAT_ALLOW_MANUAL_PRICES = false;
  let calls = 0;
  try {
    env.METALS_DEV_API_KEY = '';
    await assert.rejects(getMetalQuote({ currency: 'EGP', nisabBasis: 'GOLD_24K_85G', timezone: 'Africa/Cairo' }), /unavailable/);
    env.METALS_DEV_API_KEY = 'mock-secret-never-live';
    globalThis.fetch = async (url) => {
      calls++;
      const parsed = new URL(String(url));
      assert.equal(parsed.searchParams.get('unit'), 'g');
      assert.equal(parsed.searchParams.get('currency'), 'USD');
      return new Response(JSON.stringify({ status: 'success', currency: 'USD', unit: 'g', timestamps: { metal: new Date().toISOString(), currency: new Date(Date.now() - 120000).toISOString() },
        metals: { gold: 100, silver: 2 }, currencies: { EGP: 0.02, EUR: 1.25, JPY: 0.01, KWD: 3.25 } }), { status: 200 });
    };
    const quotes = await Promise.all(Array.from({ length: 12 }, () => getMetalQuote({ currency: 'EGP', nisabBasis: 'EGYPT_GOLD_21K_85G', timezone: 'Africa/Cairo' })));
    assert.equal(calls, 1, 'Concurrent requests share one provider request');
    assert.equal(quotes[0]!.pricePerGram, '4375.000000');
    const quote = quotes[0]!;
    assert.equal(quote.asOfUtc, quote.currencyAsOfUtc, 'Freshness uses the older metal/FX collection timestamp');
    assert(Date.parse(quote.metalAsOfUtc) > Date.parse(quote.currencyAsOfUtc));
    const input = calculationSchema.parse({ currency: quote.currency, nisabBasis: quote.nisabBasis, asOfDate: quote.asOfDate,
      pricePerGram: quote.pricePerGram, priceAsOfDate: quote.priceAsOfDate, priceSource: quote.priceSource, quoteToken: quote.quoteToken,
      hawlCompleted: true, assets: { cash: '1000000' } });
    assert.equal(assessWithMetalQuote(input).quote.verifiedByBackend, true);
    assert.equal(assessWithMetalQuote(input).dueAmount, '25000.00');
    assert.throws(() => assessWithMetalQuote({ ...input, pricePerGram: '1' }), /Invalid/);
    assert.throws(() => assessWithMetalQuote({ ...input, currency: 'USD' }), /Invalid/);
    assert.throws(() => assessWithMetalQuote({ ...input, quoteToken: quote.quoteToken + 'x' }), /Invalid/);
    assert.throws(() => assessWithMetalQuote({ ...input, quoteToken: undefined }), /Invalid/);
    assert.equal((await getMetalQuote({ currency: 'EUR', nisabBasis: 'GOLD_24K_85G', timezone: 'UTC' })).pricePerGram, '80.000000');
    assert.equal((await getMetalQuote({ currency: 'JPY', nisabBasis: 'SILVER_999_595G', timezone: 'Asia/Tokyo' })).pricePerGram, '200.000000');
    assert.equal(calls, 1, 'Different currencies and metals reuse a global snapshot');
    await assert.rejects(getMetalQuote({ currency: 'GBP', nisabBasis: 'GOLD_24K_85G', timezone: 'UTC' }), /not available/);
    Date.now = () => originalNow() + 7200000;
    assert.throws(() => assessWithMetalQuote(input), /expired/);
    globalThis.fetch = async () => { calls++; throw new Error('private upstream URL contains mock-secret-never-live'); };
    await assert.rejects(getMetalQuote({ currency: 'EGP', nisabBasis: 'GOLD_24K_85G', timezone: 'UTC' }), error => {
      assert(!String(error).includes('mock-secret')); return /unavailable/.test(String(error));
    });
    const failures = calls;
    await assert.rejects(getMetalQuote({ currency: 'USD', nisabBasis: 'GOLD_24K_85G', timezone: 'UTC' }));
    assert.equal(calls, failures, 'Failure cooldown prevents quota retry storms');
    let offset = 7300000;
    for (const broken of [
      { status: 'success', currency: 'USD', unit: 'toz', timestamp: new Date().toISOString(), metals: { gold: 100, silver: 2 }, currencies: {} },
      { status: 'failure', error_code: 1203 },
      { status: 'success', currency: 'USD', unit: 'g', timestamp: '2020-01-01T00:00:00Z', metals: { gold: 100, silver: 2 }, currencies: {} },
      { status: 'success', currency: 'USD', unit: 'g', timestamp: '2099-01-01T00:00:00Z', metals: { gold: 100, silver: 2 }, currencies: {} },
      { status: 'success', currency: 'USD', unit: 'g', timestamps: { metal: new Date().toISOString(), currency: '2020-01-01T00:00:00Z' }, metals: { gold: 100, silver: 2 }, currencies: {} },
      { status: 'success', currency: 'USD', unit: 'g', timestamps: { metal: '2020-01-01T00:00:00Z', currency: new Date().toISOString() }, metals: { gold: 100, silver: 2 }, currencies: {} },
      { status: 'success', currency: 'USD', unit: 'g', metals: { gold: 100, silver: 2 }, currencies: {} },
    ]) {
      Date.now = () => originalNow() + offset;
      globalThis.fetch = async () => new Response(JSON.stringify(broken), { status: 200 });
      await assert.rejects(getMetalQuote({ currency: 'USD', nisabBasis: 'GOLD_24K_85G', timezone: 'UTC' }), /unavailable/);
      offset += 70000;
    }
    console.log('Metal-price regression checks passed (mock provider, no live API calls).');
  } finally { globalThis.fetch = originalFetch; Date.now = originalNow; env.METALS_DEV_API_KEY = originalKey; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

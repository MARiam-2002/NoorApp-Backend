/**
 * Production smoke for the Home screen sections + Figure of the Day ("شخصية اليوم").
 * Creates a throwaway @noor.test account and deletes it at the end (DELETE /auth/me).
 * Run: API_BASE=https://noor-app-backend-one.vercel.app/api/v1 npx tsx scripts/smoke-home-figure-production.ts
 */
import { getDailyChallengeDefinition } from '../src/shared/data/daily-challenges';
import { SAJDAH_VERSES_CATALOG } from '../src/shared/constants/sajdah-verses';

const BASE = process.env.API_BASE || 'https://noor-app-backend-one.vercel.app/api/v1';

type Res = { status: number; json: any; ms: number };

async function req(method: string, path: string, opts: { token?: string; body?: unknown } = {}): Promise<Res> {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json, ms: Date.now() - t0 };
}

let failures = 0;
function check(name: string, cond: unknown, detail = '') {
  if (cond) console.log(`PASS  ${name}${detail ? `  ${detail}` : ''}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail ? `  ${detail}` : ''}`);
  }
}

const LITE_KEYS = ['honorificAr', 'id', 'nameAr', 'nameEn', 'summaryAr', 'titleAr', 'titleEn'];
const DETAIL_KEYS = [...LITE_KEYS, 'catalogVersion', 'evidence', 'lessonAr', 'sources', 'storyAr'].sort();

async function main() {
  console.log('BASE', BASE);

  // ── Figure of the Day (public) ────────────────────────────────────────────
  const fod = await req('GET', '/content/figure-of-day');
  const f = fod.json?.data;
  check('GET /content/figure-of-day → 200', fod.status === 200 && fod.json.success, `${fod.ms}ms id=${f?.id}`);
  check(
    'figure-of-day keys',
    f && JSON.stringify(Object.keys(f).sort()) === JSON.stringify([...DETAIL_KEYS, 'dayOfYear'].sort()),
    f ? Object.keys(f).join(',') : '',
  );
  check('figure-of-day storyAr ≥ 2 paragraphs', Array.isArray(f?.storyAr) && f.storyAr.length >= 2);
  check(
    'figure-of-day evidence cited with number',
    Array.isArray(f?.evidence) &&
      f.evidence.length >= 1 &&
      f.evidence.every((e: any) => e.number > 0 && /^رواه (البخاري|مسلم) — رقم \d+$/.test(e.sourceAr) && e.textAr),
  );

  const d1 = await req('GET', '/content/figure-of-day?day=1');
  const d2 = await req('GET', '/content/figure-of-day?day=2');
  check('figure-of-day?day=1 → 200 dayOfYear=1', d1.status === 200 && d1.json.data.dayOfYear === 1);
  check('daily rotation: day 1 ≠ day 2', d1.json?.data?.id && d1.json.data.id !== d2.json?.data?.id, `${d1.json?.data?.id} / ${d2.json?.data?.id}`);
  const d1b = await req('GET', '/content/figure-of-day?day=1');
  check('stable for the same day', d1b.json?.data?.id === d1.json?.data?.id);

  const bad0 = await req('GET', '/content/figure-of-day?day=0');
  const bad367 = await req('GET', '/content/figure-of-day?day=367');
  const badTxt = await req('GET', '/content/figure-of-day?day=abc');
  check('figure-of-day?day=0 → 400 VALIDATION_ERROR', bad0.status === 400 && bad0.json.code === 'VALIDATION_ERROR');
  check('figure-of-day?day=367 → 400', bad367.status === 400);
  check('figure-of-day?day=abc → 400', badTxt.status === 400);

  const list = await req('GET', '/content/figures');
  const items = list.json?.data?.items ?? [];
  check('GET /content/figures → 200', list.status === 200, `${list.ms}ms total=${list.json?.data?.total}`);
  check('figures total = items.length ≥ 30', items.length >= 30 && list.json.data.total === items.length);
  check('figures items are lite', items.every((i: any) => JSON.stringify(Object.keys(i).sort()) === JSON.stringify(LITE_KEYS)));
  check('figures ids unique', new Set(items.map((i: any) => i.id)).size === items.length);

  const musab = await req('GET', '/content/figures/musab-ibn-umair');
  check(
    'GET /content/figures/musab-ibn-umair → 200 (design sample)',
    musab.status === 200 && musab.json.data.nameAr === 'مصعب بن عمير' && musab.json.data.titleAr === 'أول سفير في الإسلام',
  );
  check('figures/:id has no dayOfYear', musab.json?.data && !('dayOfYear' in musab.json.data));
  const nf = await req('GET', '/content/figures/unknown-person');
  check('GET /content/figures/unknown-person → 404 NOT_FOUND', nf.status === 404 && nf.json.code === 'NOT_FOUND');

  let allDetailsOk = true;
  for (const it of items) {
    const r = await req('GET', `/content/figures/${it.id}`);
    if (r.status !== 200 || r.json.data.id !== it.id || !(r.json.data.evidence?.length >= 1)) {
      allDetailsOk = false;
      console.log('   bad detail', it.id, r.status);
    }
  }
  check(`all ${items.length} figure details resolve with evidence`, allDetailsOk);

  const credits = await req('GET', '/content/credits');
  check(
    'GET /content/credits → version 2 with figures item',
    credits.status === 200 && credits.json.data.version === 2 && credits.json.data.items.some((i: any) => i.key === 'figures'),
  );

  // ── Home public sections ──────────────────────────────────────────────────
  for (const [name, path] of [
    ['verse-of-day', '/content/verse-of-day'],
    ['hadith-of-day', '/content/hadith-of-day'],
    ['stances/today (guest)', '/stances/today'],
    ['sajdah-verses', '/quran/sajdah-verses'],
    ['prayers/today (guest)', '/prayers/today'],
  ] as const) {
    const r = await req('GET', path);
    check(`GET ${path} → 200`, r.status === 200 && r.json.success, `${r.ms}ms (${name})`);
  }

  const noAuth = await req('GET', '/dashboard');
  check('GET /dashboard without token → 401', noAuth.status === 401);

  // ── Authenticated Home ────────────────────────────────────────────────────
  const email = `home.figure.${Date.now()}@noor.test`;
  const sign = await req('POST', '/auth/sign-up', {
    body: { email, password: 'SmokeTest123!', fullName: 'Home Figure Smoke' },
  });
  const token: string | undefined = sign.json?.data?.tokens?.accessToken;
  check('POST /auth/sign-up (temp account)', sign.status === 201 && token);
  if (!token) throw new Error('cannot continue without token');

  try {
    const dash = await req('GET', '/dashboard', { token });
    const d = dash.json?.data;
    check('GET /dashboard → 200', dash.status === 200 && dash.json.success, `${dash.ms}ms`);
    for (const key of ['greeting', 'prayers', 'verseOfTheDay', 'hadithOfTheDay', 'figureOfTheDay', 'dailyJourney', 'khatmah', 'dailyChallenge', 'utilities']) {
      check(`dashboard.${key} present`, d && d[key] != null);
    }
    check(
      'dashboard.figureOfTheDay has exactly the lite keys',
      d?.figureOfTheDay && JSON.stringify(Object.keys(d.figureOfTheDay).sort()) === JSON.stringify(LITE_KEYS),
    );
    check('dashboard.figureOfTheDay.id === /content/figure-of-day id', d?.figureOfTheDay?.id === f?.id, `${d?.figureOfTheDay?.id}`);
    check('greeting.hijriDate non-empty', typeof d?.greeting?.hijriDate === 'string' && d.greeting.hijriDate.length > 0, d?.greeting?.hijriDate);
    check('prayers.schedule has 5', d?.prayers?.schedule?.length === 5);
    check('prayers.nextPrayer.countdownSeconds number', typeof d?.prayers?.nextPrayer?.countdownSeconds === 'number');
    check('verseOfTheDay text + reference', d?.verseOfTheDay?.textAr && d?.verseOfTheDay?.referenceAr);
    check('hadithOfTheDay text + source', d?.hadithOfTheDay?.textAr && d?.hadithOfTheDay?.sourceAr, d?.hadithOfTheDay?.sourceAr);
    for (const tile of ['prayer', 'quran', 'adhkar', 'sadaqah']) {
      check(`dailyJourney.${tile} present`, d?.dailyJourney?.[tile] != null);
    }
    check('khatmah surahNameAr + progressPercent', d?.khatmah?.surahNameAr && typeof d?.khatmah?.progressPercent === 'number');
    check('dailyChallenge titleAr + rewardPoints', d?.dailyChallenge?.titleAr && typeof d?.dailyChallenge?.rewardPoints === 'number');

    for (const path of ['/notifications/unread-count', '/quran/sajdah-verses/my-progress', '/quran/khatmah/stats', '/challenges/today', '/journey/today', '/stances/today']) {
      const r = await req('GET', path, { token });
      check(`GET ${path} (auth) → 200`, r.status === 200 && r.json.success, `${r.ms}ms`);
    }

    const ch = (await req('GET', '/challenges/today', { token })).json?.data;
    const bank = ch ? getDailyChallengeDefinition(ch.dayOfYear) : undefined;
    check('challenge of the day equals the bank entry for the server day',
      bank && ch.titleAr === bank.titleAr && ch.titleEn === bank.titleEn && ch.descriptionEn === bank.descriptionEn
        && ch.type === bank.type && ch.targetValue === bank.targetValue, `day ${ch?.dayOfYear}: ${ch?.titleEn}`);
    check('dashboard.dailyChallenge English matches /challenges/today',
      d?.dailyChallenge?.titleEn === ch?.titleEn && d?.dailyChallenge?.descriptionEn === ch?.descriptionEn);

    const sp = (await req('GET', '/quran/sajdah-verses/my-progress?scope=full', { token })).json?.data;
    const keys = (sp?.rows ?? []).map((r: { verseKey: string }) => r.verseKey);
    check('sajdah my-progress: 15 Mushaf rows in order',
      JSON.stringify(keys) === JSON.stringify(SAJDAH_VERSES_CATALOG.map((v) => `${v.surahId}:${v.ayahNumber}`)));
    check('sajdah summary totals 10 / 15', sp?.summary?.muataqidahTotal === 10 && sp?.summary?.fullTotal === 15);
    check('sajdah agreed rows = 10', (sp?.rows ?? []).filter((r: { isIn10Muataqidah: boolean }) => r.isIn10Muataqidah).length === 10);
    const oldKey = await req('PATCH', '/quran/sajdah-verses/16/49', { token, body: {} });
    check('PATCH old key 16:49 → 400 VALIDATION_ERROR', oldKey.status === 400 && oldKey.json?.code === 'VALIDATION_ERROR');
    const toggle = await req('PATCH', '/quran/sajdah-verses/16/50', { token, body: {} });
    check('PATCH 16:50 → 200, completed, +20 points',
      toggle.status === 200 && toggle.json?.data?.toggledVerse?.pointsAwarded === 20 && toggle.json?.data?.summary?.muataqidahCompleted === 1);
  } finally {
    const del = await req('DELETE', '/auth/me', { token });
    check('DELETE /auth/me (cleanup temp account)', del.status === 200 && del.json?.data?.deleted === true);
  }

  console.log(failures === 0 ? '\nALL PRODUCTION CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  if (failures) process.exit(1);
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});

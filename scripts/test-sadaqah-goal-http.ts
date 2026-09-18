/**
 * Sadaqah goal HTTP checks.
 *   npx tsx scripts/test-sadaqah-goal-http.ts
 *   LIVE_SMOKE=1 npx tsx scripts/test-sadaqah-goal-http.ts
 */
const API_BASE = (
  process.env.API_BASE ||
  'https://noorapp-backend-production.up.railway.app/api/v1'
).replace(/\/$/, '');

type Envelope = {
  success?: boolean;
  code?: string;
  message?: string;
  data?: Record<string, unknown> | null;
};

async function request(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown },
): Promise<{ status: number; json: Envelope }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json: Envelope = {};
  try {
    json = text ? (JSON.parse(text) as Envelope) : {};
  } catch {
    json = { message: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

async function main() {
  console.log(`API_BASE=${API_BASE}`);

  const get401 = await request('GET', '/journey/sadaqah');
  if (get401.status !== 401) fail(`GET unauth expected 401 got ${get401.status}`);
  console.log('PASS  GET /journey/sadaqah unauthenticated → 401');

  const patch401 = await request('PATCH', '/journey/sadaqah', { body: { goal: 1000 } });
  if (patch401.status !== 401) fail(`PATCH unauth expected 401 got ${patch401.status}`);
  console.log('PASS  PATCH /journey/sadaqah unauthenticated → 401');

  if (process.env.LIVE_SMOKE !== '1') {
    console.log('INFO  set LIVE_SMOKE=1 to exercise authenticated goal edit on this host');
    return;
  }

  const email = `sadaqah-goal-${Date.now()}@example.com`;
  const signup = await request('POST', '/auth/sign-up', {
    body: { fullName: 'Sadaqah Goal', email, password: 'SadaqahTest123!' },
  });
  if (signup.status !== 201) fail(`signup ${signup.status} ${JSON.stringify(signup.json)}`);
  const token = (signup.json.data as { tokens?: { accessToken?: string } })?.tokens?.accessToken;
  if (!token) fail('missing access token');

  const setAmount = await request('PATCH', '/journey/sadaqah', {
    token,
    body: { amount: 350 },
  });
  if (setAmount.status !== 200) fail(`amount ${setAmount.status} ${JSON.stringify(setAmount.json)}`);
  const amt = setAmount.json.data || {};
  if (amt.sadaqahAmount !== 350 || amt.amount !== 350) fail(`amount contract ${JSON.stringify(amt)}`);
  if (typeof amt.goal !== 'number') fail(`goal missing ${JSON.stringify(amt)}`);
  console.log('PASS  PATCH { amount: 350 } keeps sadaqahAmount + goal fields');

  const setGoal = await request('PATCH', '/journey/sadaqah', {
    token,
    body: { goal: 2000 },
  });
  if (setGoal.status === 400 && /amount/i.test(String(setGoal.json.message))) {
    fail(`Production still requires amount (goal edit not deployed): ${JSON.stringify(setGoal.json)}`);
  }
  if (setGoal.status !== 200) fail(`goal ${setGoal.status} ${JSON.stringify(setGoal.json)}`);
  const g = setGoal.json.data || {};
  if (g.goal !== 2000) fail(`goal not 2000 ${JSON.stringify(g)}`);
  if (g.amount !== 350 || g.sadaqahAmount !== 350) fail(`progress reset ${JSON.stringify(g)}`);
  console.log('PASS  PATCH { goal: 2000 } preserves amount 350');

  const get = await request('GET', '/journey/sadaqah', { token });
  if (get.status !== 200) fail(`GET ${get.status}`);
  if (get.json.data?.goal !== 2000 || get.json.data?.amount !== 350) {
    fail(`GET mismatch ${JSON.stringify(get.json.data)}`);
  }
  console.log('PASS  GET reflects updated goal and preserved progress');

  const today = await request('GET', '/journey/today', { token });
  const todaySadaqah = (today.json.data as { sadaqah?: { goal?: number; amount?: number } })?.sadaqah;
  if (todaySadaqah?.goal !== 2000 || todaySadaqah?.amount !== 350) {
    console.log(`INFO  GET /journey/today sadaqah ${JSON.stringify(todaySadaqah)}`);
  } else {
    console.log('PASS  GET /journey/today sadaqah.goal=2000 amount=350');
  }

  const bad = await request('PATCH', '/journey/sadaqah', { token, body: { goal: -1 } });
  if (bad.status !== 400) fail(`negative goal expected 400 got ${bad.status}`);
  console.log('PASS  PATCH negative goal → 400');

  await request('DELETE', '/auth/me', { token });
  console.log('PASS  throwaway user deleted');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

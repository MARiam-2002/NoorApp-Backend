/**
 * Production Nawafel checklist smoke.
 * Run: npx tsx scripts/smoke-nawafel-production.ts
 */
import assert from 'node:assert/strict';

const API =
  process.env.API_BASE?.replace(/\/$/, '') ||
  'https://noorapp-backend-production.up.railway.app/api/v1';

async function req(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown },
) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts?.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, json };
}

async function main() {
  console.log('API', API);

  const unauth = await req('GET', '/nawafel/today');
  assert.equal(unauth.status, 401);
  console.log('PASS  GET /nawafel/today → 401');

  const email = `nawafel_smoke_${Date.now()}@noor-test.local`;
  const password = 'NawafelSmoke1!';
  const username = `nwf_${Date.now().toString(36)}`;
  const signup = await req('POST', '/auth/sign-up', {
    body: { email, password, username },
  });
  const token =
    signup.json?.data?.accessToken ||
    signup.json?.data?.tokens?.accessToken ||
    '';
  assert.ok(token, `sign-up failed: ${JSON.stringify(signup.json)}`);
  console.log('PASS  sign-up');

  const today = await req('GET', '/nawafel/today', { token });
  assert.equal(today.status, 200, JSON.stringify(today.json));
  assert.equal(today.json.data.totalRakahs, 12);
  assert.equal(today.json.data.totalSlots, 5);
  assert.equal(today.json.data.items.length, 5);
  assert.equal(today.json.data.completedRakahs, 0);
  console.log('PASS  GET today empty 0/12');

  const mark = await req('PATCH', '/nawafel/FAJR_BEFORE_2/mark', { token });
  assert.equal(mark.status, 200, JSON.stringify(mark.json));
  assert.equal(mark.json.data.completed, true);
  assert.equal(mark.json.data.today.completedRakahs, 2);
  console.log('PASS  mark FAJR_BEFORE_2 → 2/12');

  const mark4 = await req('PATCH', '/nawafel/DHUHR_BEFORE_4/mark', { token });
  assert.equal(mark4.json.data.today.completedRakahs, 6);
  console.log('PASS  mark DHUHR_BEFORE_4 → 6/12');

  const unmark = await req('PATCH', '/nawafel/FAJR_BEFORE_2/mark', { token });
  assert.equal(unmark.json.data.completed, false);
  assert.equal(unmark.json.data.today.completedRakahs, 4);
  console.log('PASS  unmark FAJR → 4/12');

  const bad = await req('PATCH', '/nawafel/NOT_A_KEY/mark', { token });
  assert.ok(bad.status === 400 || bad.status === 422);
  console.log('PASS  bad key → validation');

  const dash = await req('GET', '/dashboard', { token });
  assert.equal(dash.status, 200);
  assert.ok(dash.json.data.dailyJourney?.nawafel);
  assert.equal(dash.json.data.dailyJourney.nawafel.total, 12);
  console.log('PASS  dashboard.dailyJourney.nawafel');

  await req('DELETE', '/auth/me', { token }).catch(() => null);
  console.log('nawafel production smoke: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

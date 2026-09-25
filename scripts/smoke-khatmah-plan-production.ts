/**
 * Production smoke: flexible khatmah plan + reminder prefs.
 * Run: npx tsx scripts/smoke-khatmah-plan-production.ts
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

  assert.equal((await req('GET', '/quran/khatmah/plan')).status, 401);
  assert.equal((await req('GET', '/profile/khatmah-reminder-preferences')).status, 401);
  console.log('PASS  unauth 401');

  const stamp = Date.now();
  const signup = await req('POST', '/auth/sign-up', {
    body: {
      email: `khatmah_plan_${stamp}@noor-test.local`,
      password: 'KhatmahPlan1!',
      username: `khp_${stamp.toString(36)}`,
    },
  });
  const token =
    signup.json?.data?.accessToken ||
    signup.json?.data?.tokens?.accessToken ||
    '';
  assert.ok(token, JSON.stringify(signup.json));

  const empty = await req('GET', '/quran/khatmah/plan', { token });
  assert.equal(empty.status, 200, JSON.stringify(empty.json));
  assert.equal(empty.json.data.active, false);
  console.log('PASS  no plan');

  const start = await req('POST', '/quran/khatmah/plan', {
    token,
    body: { durationDays: 15 },
  });
  assert.equal(start.status, 201, JSON.stringify(start.json));
  assert.equal(start.json.data.active, true);
  assert.equal(start.json.data.mode, 'DURATION_DAYS');
  assert.equal(start.json.data.durationDays, 15);
  assert.equal(start.json.data.pagesGoal, 604);
  assert.ok(start.json.data.todayWard.pagesTarget >= 1);
  console.log('PASS  start durationDays=15');

  const both = await req('POST', '/quran/khatmah/plan', {
    token,
    body: { durationDays: 30, juzPerMonth: 15 },
  });
  assert.ok(both.status === 400 || both.status === 422);
  console.log('PASS  reject both fields');

  const juz = await req('POST', '/quran/khatmah/plan', {
    token,
    body: { juzPerMonth: 30 },
  });
  assert.equal(juz.status, 201);
  assert.equal(juz.json.data.mode, 'JUZ_PER_MONTH');
  assert.equal(juz.json.data.juzPerMonth, 30);
  console.log('PASS  start juzPerMonth=30');

  const rem = await req('GET', '/profile/khatmah-reminder-preferences', { token });
  assert.equal(rem.status, 200);
  assert.equal(rem.json.data.enabled, false);
  assert.equal(rem.json.data.time, '21:00');
  assert.equal(rem.json.data.eventType, 'KHATMAH');

  const remOn = await req('PATCH', '/profile/khatmah-reminder-preferences', {
    token,
    body: { enabled: true, time: '21:00' },
  });
  assert.equal(remOn.json.data.enabled, true);
  console.log('PASS  reminder prefs');

  const stats = await req('GET', '/quran/khatmah/stats', { token });
  assert.equal(stats.status, 200);
  assert.ok(stats.json.data.plan?.active === true);
  console.log('PASS  stats.plan additive');

  await req('DELETE', '/quran/khatmah/plan', { token });
  const cleared = await req('GET', '/quran/khatmah/plan', { token });
  assert.equal(cleared.json.data.active, false);
  console.log('PASS  clear plan');

  await req('PATCH', '/profile/khatmah-reminder-preferences', {
    token,
    body: { enabled: false },
  });
  await req('DELETE', '/auth/me', { token }).catch(() => null);
  console.log('khatmah plan production smoke: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

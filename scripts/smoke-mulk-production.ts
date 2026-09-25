/**
 * Production Mulk prefs smoke (HTTP).
 * Run: npx tsx scripts/smoke-mulk-production.ts
 *
 * Optional env:
 *   API_BASE  — default production /api/v1
 *   EMAIL / PASSWORD — existing user; otherwise signs up a throwaway
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

  const unauth = await req('GET', '/profile/mulk-preferences');
  assert.equal(unauth.status, 401);
  console.log('PASS  GET /profile/mulk-preferences unauthenticated → 401');

  let token = process.env.TOKEN || '';
  if (!token) {
    const email =
      process.env.EMAIL ||
      `mulk_smoke_${Date.now()}@noor-test.local`;
    const password = process.env.PASSWORD || 'MulkSmoke1!';
    const username = `mulk_${Date.now().toString(36)}`;

    if (process.env.EMAIL && process.env.PASSWORD) {
      const login = await req('POST', '/auth/sign-in', {
        body: { email: process.env.EMAIL, password: process.env.PASSWORD },
      });
      token = login.json?.data?.accessToken || login.json?.data?.tokens?.accessToken || '';
      assert.ok(token, `sign-in failed: ${JSON.stringify(login.json)}`);
    } else {
      const signup = await req('POST', '/auth/sign-up', {
        body: { email, password, username },
      });
      token =
        signup.json?.data?.accessToken ||
        signup.json?.data?.tokens?.accessToken ||
        '';
      assert.ok(token, `sign-up failed: ${JSON.stringify(signup.json)}`);
    }
  }

  const get = await req('GET', '/profile/mulk-preferences', { token });
  assert.equal(get.status, 200, JSON.stringify(get.json));
  assert.equal(get.json.data.enabled, false);
  assert.equal(get.json.data.time, '20:00');
  assert.equal(get.json.data.surahId, 67);
  assert.equal(get.json.data.deepLink, '/quran/surah/67');
  assert.equal(get.json.data.bodyAr, 'لا تنس قراءة سورة الملك');
  console.log('PASS  GET defaults enabled=false time=20:00');

  const patch = await req('PATCH', '/profile/mulk-preferences', {
    token,
    body: { enabled: true, time: '20:00' },
  });
  assert.equal(patch.status, 200, JSON.stringify(patch.json));
  assert.equal(patch.json.data.enabled, true);
  assert.equal(patch.json.data.time, '20:00');
  console.log('PASS  PATCH enabled=true time=20:00');

  const put = await req('PUT', '/profile/mulk-preferences', {
    token,
    body: { time: '21:00' },
  });
  assert.equal(put.status, 200, JSON.stringify(put.json));
  assert.equal(put.json.data.time, '21:00');
  assert.equal(put.json.data.enabled, true);
  console.log('PASS  PUT time=21:00');

  const bad = await req('PATCH', '/profile/mulk-preferences', {
    token,
    body: { time: '25:00' },
  });
  assert.ok(bad.status === 400 || bad.status === 422, `expected validation error, got ${bad.status}`);
  console.log('PASS  PATCH invalid time → validation error');

  // Restore safe default for throwaway accounts
  await req('PATCH', '/profile/mulk-preferences', {
    token,
    body: { enabled: false, time: '20:00' },
  });
  console.log('PASS  restore enabled=false');

  console.log('mulk production smoke: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

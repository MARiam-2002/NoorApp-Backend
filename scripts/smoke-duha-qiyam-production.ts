/**
 * Production smoke: Duha + Qiyam prefs (custom voice defaults).
 * Run: npx tsx scripts/smoke-duha-qiyam-production.ts
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

  assert.equal((await req('GET', '/profile/duha-preferences')).status, 401);
  assert.equal((await req('GET', '/profile/qiyam-preferences')).status, 401);
  console.log('PASS  unauth 401');

  const mediaDuha = await fetch(`${API}/azan/media/sc_event_duha.mp3`);
  const mediaQiyam = await fetch(`${API}/azan/media/sc_event_qiyam.mp3`);
  assert.ok(mediaDuha.ok, 'duha media must be reachable');
  assert.ok(mediaQiyam.ok, 'qiyam media must be reachable');
  console.log('PASS  media sc_event_duha + sc_event_qiyam');

  const email = `duha_qiyam_${Date.now()}@noor-test.local`;
  const signup = await req('POST', '/auth/sign-up', {
    body: {
      email,
      password: 'DuhaQiyam1!',
      username: `dq_${Date.now().toString(36)}`,
    },
  });
  const token =
    signup.json?.data?.accessToken ||
    signup.json?.data?.tokens?.accessToken ||
    '';
  assert.ok(token, JSON.stringify(signup.json));

  const duha = await req('GET', '/profile/duha-preferences', { token });
  assert.equal(duha.status, 200, JSON.stringify(duha.json));
  assert.equal(duha.json.data.enabled, false);
  assert.equal(duha.json.data.time, '09:30');
  assert.equal(duha.json.data.soundId, 'sc_event_duha');
  assert.equal(duha.json.data.usesCustomVoice, true);
  console.log('PASS  duha defaults');

  const qiyam = await req('GET', '/profile/qiyam-preferences', { token });
  assert.equal(qiyam.status, 200, JSON.stringify(qiyam.json));
  assert.equal(qiyam.json.data.enabled, false);
  assert.equal(qiyam.json.data.time, '02:30');
  assert.equal(qiyam.json.data.soundId, 'sc_event_qiyam');
  console.log('PASS  qiyam defaults');

  const patchD = await req('PATCH', '/profile/duha-preferences', {
    token,
    body: { enabled: true, time: '10:00' },
  });
  assert.equal(patchD.json.data.enabled, true);
  assert.equal(patchD.json.data.time, '10:00');
  assert.equal(patchD.json.data.soundId, 'sc_event_duha');

  const patchQ = await req('PATCH', '/profile/qiyam-preferences', {
    token,
    body: { enabled: true },
  });
  assert.equal(patchQ.json.data.enabled, true);
  assert.equal(patchQ.json.data.soundId, 'sc_event_qiyam');
  console.log('PASS  patch enable');

  await req('PATCH', '/profile/duha-preferences', {
    token,
    body: { enabled: false, time: '09:30' },
  });
  await req('PATCH', '/profile/qiyam-preferences', {
    token,
    body: { enabled: false },
  });
  await req('DELETE', '/auth/me', { token }).catch(() => null);
  console.log('duha+qiyam production smoke: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

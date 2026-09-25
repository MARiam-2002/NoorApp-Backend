/**
 * Full production verification for Nawafel + Notification settings (+ related).
 * Run: npx tsx scripts/verify-nawafel-notifications-production.ts
 */
import assert from 'node:assert/strict';

const API =
  process.env.API_BASE?.replace(/\/$/, '') ||
  'https://noorapp-backend-production.up.railway.app/api/v1';

type Res = { status: number; json: any };

async function req(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown },
): Promise<Res> {
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

async function mediaOk(path: string) {
  const res = await fetch(`${API}${path}`);
  assert.ok(res.ok, `${path} → ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  assert.ok(ct.includes('audio') || ct.includes('mpeg') || ct.includes('octet'), `bad ct ${ct} for ${path}`);
}

function pass(msg: string) {
  console.log(`PASS  ${msg}`);
}

async function main() {
  console.log('API', API);
  const fails: string[] = [];

  // --- Health ---
  const health = await req('GET', '/health');
  assert.equal(health.status, 200);
  assert.equal(health.json?.data?.status, 'ok');
  assert.equal(health.json?.data?.database, 'connected');
  assert.equal(health.json?.data?.fcm?.configured, true);
  pass('health ok + db + fcm');

  // --- Media ---
  await mediaOk('/azan/media/sc_event_duha.mp3');
  await mediaOk('/azan/media/sc_event_qiyam.mp3');
  pass('duha + qiyam media');

  // --- Auth gates ---
  assert.equal((await req('GET', '/nawafel/today')).status, 401);
  assert.equal((await req('GET', '/profile/mulk-preferences')).status, 401);
  assert.equal((await req('GET', '/profile/duha-preferences')).status, 401);
  assert.equal((await req('GET', '/profile/qiyam-preferences')).status, 401);
  pass('unauth → 401 on protected prefs');

  // --- Sign up ---
  const stamp = Date.now();
  const signup = await req('POST', '/auth/sign-up', {
    body: {
      email: `verify_nn_${stamp}@noor-test.local`,
      password: 'VerifyNn100!',
      username: `vnn_${stamp.toString(36)}`,
    },
  });
  const token =
    signup.json?.data?.accessToken ||
    signup.json?.data?.tokens?.accessToken ||
    '';
  assert.ok(token, `sign-up failed: ${JSON.stringify(signup.json)}`);
  pass('sign-up');

  // --- Nawafel ---
  const today = await req('GET', '/nawafel/today', { token });
  assert.equal(today.status, 200, JSON.stringify(today.json));
  assert.equal(today.json.data.totalRakahs, 12);
  assert.equal(today.json.data.totalSlots, 5);
  assert.equal(today.json.data.items?.length, 5);
  assert.equal(today.json.data.completedRakahs, 0);

  const keys = [
    'FAJR_BEFORE_2',
    'DHUHR_BEFORE_4',
    'DHUHR_AFTER_2',
    'MAGHRIB_AFTER_2',
    'ISHA_AFTER_2',
  ];
  for (const key of keys) {
    const m = await req('PATCH', `/nawafel/${key}/mark`, { token });
    assert.equal(m.status, 200, `${key}: ${JSON.stringify(m.json)}`);
    assert.equal(m.json.data.completed, true);
  }
  const full = await req('GET', '/nawafel/today', { token });
  assert.equal(full.json.data.completedRakahs, 12);
  assert.equal(full.json.data.completedSlots, 5);
  assert.equal(full.json.data.progress, 1);

  const un = await req('PATCH', '/nawafel/FAJR_BEFORE_2/mark', { token });
  assert.equal(un.json.data.completed, false);
  assert.equal(un.json.data.today.completedRakahs, 10);

  const bad = await req('PATCH', '/nawafel/BAD_KEY/mark', { token });
  assert.ok(bad.status === 400 || bad.status === 422);
  pass('nawafel 12/12 + toggle + validation');

  // --- Mulk ---
  const mulkGet = await req('GET', '/profile/mulk-preferences', { token });
  assert.equal(mulkGet.status, 200);
  assert.equal(mulkGet.json.data.enabled, false);
  assert.equal(mulkGet.json.data.time, '20:00');
  assert.equal(mulkGet.json.data.surahId, 67);
  assert.equal(mulkGet.json.data.bodyAr, 'لا تنس قراءة سورة الملك');

  const mulkOn = await req('PATCH', '/profile/mulk-preferences', {
    token,
    body: { enabled: true, time: '20:00' },
  });
  assert.equal(mulkOn.json.data.enabled, true);
  await req('PATCH', '/profile/mulk-preferences', {
    token,
    body: { enabled: false },
  });
  pass('mulk prefs');

  // --- Duha ---
  const duhaGet = await req('GET', '/profile/duha-preferences', { token });
  assert.equal(duhaGet.status, 200);
  assert.equal(duhaGet.json.data.enabled, false);
  assert.equal(duhaGet.json.data.time, '09:30');
  assert.equal(duhaGet.json.data.soundId, 'sc_event_duha');
  assert.equal(duhaGet.json.data.usesCustomVoice, true);
  assert.ok(String(duhaGet.json.data.audioUrl || '').includes('sc_event_duha.mp3'));

  const duhaOn = await req('PATCH', '/profile/duha-preferences', {
    token,
    body: { enabled: true, time: '10:15' },
  });
  assert.equal(duhaOn.json.data.enabled, true);
  assert.equal(duhaOn.json.data.time, '10:15');
  assert.equal(duhaOn.json.data.soundId, 'sc_event_duha');
  await req('PATCH', '/profile/duha-preferences', {
    token,
    body: { enabled: false, time: '09:30' },
  });
  pass('duha prefs + custom voice');

  // --- Qiyam ---
  const qiyamGet = await req('GET', '/profile/qiyam-preferences', { token });
  assert.equal(qiyamGet.status, 200);
  assert.equal(qiyamGet.json.data.enabled, false);
  assert.equal(qiyamGet.json.data.time, '02:30');
  assert.equal(qiyamGet.json.data.soundId, 'sc_event_qiyam');
  assert.equal(qiyamGet.json.data.usesCustomVoice, true);

  const qiyamOn = await req('PATCH', '/profile/qiyam-preferences', {
    token,
    body: { enabled: true },
  });
  assert.equal(qiyamOn.json.data.enabled, true);
  assert.equal(qiyamOn.json.data.soundId, 'sc_event_qiyam');
  await req('PATCH', '/profile/qiyam-preferences', {
    token,
    body: { enabled: false },
  });
  pass('qiyam prefs + custom voice');

  // --- Dashboard additive ---
  const dash = await req('GET', '/dashboard', { token });
  assert.equal(dash.status, 200, JSON.stringify(dash.json));
  const n = dash.json.data?.dailyJourney?.nawafel;
  assert.ok(n, 'dailyJourney.nawafel missing');
  assert.equal(n.total, 12);
  assert.equal(n.completed, 10); // after unmark fajr
  pass('dashboard.dailyJourney.nawafel');

  // --- Cron auth (no secret → 401) ---
  const cron = await req('POST', '/cron/prayer-reminders');
  assert.equal(cron.status, 401);
  pass('cron prayer-reminders unauth → 401');

  // cleanup
  await req('DELETE', '/auth/me', { token }).catch(() => null);

  console.log('\n========================================');
  console.log('PRODUCTION VERIFY: 100% PASS');
  console.log('Nawafel + Mulk + Duha + Qiyam + media + dashboard');
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('\nPRODUCTION VERIFY FAILED\n', err);
  process.exit(1);
});

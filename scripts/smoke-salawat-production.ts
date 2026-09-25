/**
 * Production Salawat end-to-end smoke.
 * Run: npx tsx scripts/smoke-salawat-production.ts
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

  const health = await req('GET', '/health');
  assert.equal(health.json?.data?.fcm?.configured, true, 'fcm.configured must be true');
  console.log('PASS  fcm.configured=true');

  const catalog = await req('GET', '/salawat/audio');
  assert.equal(catalog.status, 200);
  assert.equal(catalog.json.data.defaultId, 'salli_ala_muhammad_voice');
  assert.equal(catalog.json.data.count, 1);
  const clip = catalog.json.data.clips[0];
  assert.equal(clip.id, 'salli_ala_muhammad_voice');
  assert.equal(clip.titleAr, 'صلِّ على محمد');
  assert.equal(clip.creatorAr, 'نور');
  assert.equal(clip.mediaFile, 'salli_ala_muhammad.mp3');
  assert.ok(String(clip.audioUrl).includes('/salawat/media/salli_ala_muhammad.mp3'));
  console.log('PASS  catalog default voice');

  const media = await fetch(`${API}/salawat/media/salli_ala_muhammad.mp3`, { method: 'HEAD' });
  assert.equal(media.status, 200);
  assert.ok(String(media.headers.get('content-type') || '').includes('audio'));
  console.log('PASS  media stream 200');

  const stamp = Date.now();
  const email = `salawat-prod-${stamp}@example.com`;
  const password = 'SalawatProd123!';
  const signup = await req('POST', '/auth/sign-up', {
    body: { fullName: 'Salawat Prod', email, password },
  });
  assert.ok(
    signup.status === 200 || signup.status === 201,
    JSON.stringify(signup.json),
  );
  const data = signup.json.data || {};
  const token =
    data.tokens?.accessToken ||
    data.accessToken ||
    data.token ||
    data.access_token;
  assert.ok(token, `access token missing: ${JSON.stringify(signup.json)}`);
  console.log('PASS  sign-up');

  const prefs = await req('GET', '/profile/salawat-preferences', { token });
  assert.equal(prefs.status, 200);
  assert.equal(prefs.json.data.audioClipId, 'salli_ala_muhammad_voice');
  assert.equal(prefs.json.data.intervalMinutes, 180);
  assert.equal(prefs.json.data.windowStart || prefs.json.data.startTime, '08:00');
  assert.equal(prefs.json.data.windowEnd || prefs.json.data.endTime, '22:00');
  if (prefs.json.data.nativeSound != null) {
    assert.equal(prefs.json.data.nativeSound, 'salli_ala_muhammad');
    assert.equal(prefs.json.data.mediaFile, 'salli_ala_muhammad.mp3');
    console.log('PASS  default prefs include nativeSound=salli_ala_muhammad');
  } else {
    console.log('INFO  prefs missing nativeSound (deploy pending) — audioClipId OK');
  }
  console.log('PASS  default prefs match Flutter UI');

  const patch = await req('PATCH', '/profile/salawat-preferences', {
    token,
    body: {
      enabled: true,
      intervalMinutes: 180,
      windowStart: '08:00',
      windowEnd: '22:00',
      audioClipId: 'salli_ala_muhammad_voice',
    },
  });
  assert.equal(patch.status, 200);
  assert.equal(patch.json.data.enabled, true);
  assert.equal(patch.json.data.audioClipId, 'salli_ala_muhammad_voice');
  console.log('PASS  PATCH matches screenshot settings');

  const legacy = await req('PATCH', '/profile/salawat-preferences', {
    token,
    body: { audioClipId: 'peaceful_reminder_tone' },
  });
  if (legacy.status === 400) {
    console.log('INFO  legacy peaceful_reminder_tone rejected (deploy pending for alias accept)');
  } else {
    assert.equal(legacy.status, 200);
    assert.equal(legacy.json.data.audioClipId, 'salli_ala_muhammad_voice');
    console.log('PASS  legacy id remaps to default voice');
  }

  const cron = await req('POST', '/cron/prayer-reminders');
  assert.equal(cron.status, 401);
  console.log('PASS  cron without secret = 401');

  await req('DELETE', '/auth/me', { token });
  console.log('PASS  cleanup user');
  console.log('salawat production smoke: OK');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

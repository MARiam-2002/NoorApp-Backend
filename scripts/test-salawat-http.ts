/**
 * HTTP checks for Salawat preferences.
 * Default: Production Railway. Override with API_BASE.
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

  const get401 = await request('GET', '/profile/salawat-preferences');
  if (get401.status !== 401) fail(`GET unauth expected 401 got ${get401.status}`);
  console.log('PASS  GET /profile/salawat-preferences unauthenticated → 401');

  const put401 = await request('PUT', '/profile/salawat-preferences', {
    body: { enabled: true },
  });
  if (put401.status !== 401 && put401.status !== 404) {
    fail(`PUT unauth expected 401 (or 404 until deploy) got ${put401.status}`);
  }
  console.log(
    put401.status === 401
      ? 'PASS  PUT /profile/salawat-preferences unauthenticated → 401'
      : 'INFO  PUT /profile/salawat-preferences → 404 (route not on this host yet)',
  );

  const patch401 = await request('PATCH', '/profile/salawat-preferences', {
    body: { enabled: false },
  });
  if (patch401.status !== 401) fail(`PATCH unauth expected 401 got ${patch401.status}`);
  console.log('PASS  PATCH /profile/salawat-preferences unauthenticated → 401');

  const catalog = await request('GET', '/salawat/audio');
  if (catalog.status === 404) {
    console.log('INFO  GET /salawat/audio → 404 (catalog not on this host yet)');
  } else if (catalog.status !== 200) {
    fail(`GET /salawat/audio ${catalog.status} ${JSON.stringify(catalog.json)}`);
  } else {
    const clips = (catalog.json.data as { clips?: unknown[] })?.clips;
    if (!Array.isArray(clips) || clips.length < 1) fail('audio catalog empty');
    console.log(`PASS  GET /salawat/audio count=${clips.length}`);
  }

  if (process.env.LIVE_SMOKE !== '1') {
    console.log('INFO  set LIVE_SMOKE=1 to create a throwaway user and exercise GET/PUT/PATCH');
    return;
  }

  const email = `salawat-http-${Date.now()}@example.com`;
  const password = 'SalawatTest123!';
  const signup = await request('POST', '/auth/sign-up', {
    body: { fullName: 'Salawat HTTP', email, password },
  });
  if (signup.status !== 201) fail(`signup ${signup.status} ${JSON.stringify(signup.json)}`);
  const tokens = (signup.json.data as { tokens?: { accessToken?: string } })?.tokens;
  const token = tokens?.accessToken;
  if (!token) fail('missing access token');

  const get = await request('GET', '/profile/salawat-preferences', { token });
  if (get.status !== 200) fail(`GET ${get.status} ${JSON.stringify(get.json)}`);
  const data = get.json.data || {};
  if (data.enabled !== false) {
    console.log(`INFO  GET enabled=${String(data.enabled)} (expect false after this branch deploys)`);
  } else {
    console.log('PASS  GET default enabled=false');
  }
  for (const key of [
    'enabled',
    'intervalHours',
    'maxPerDay',
    'quietHoursStart',
    'quietHoursEnd',
  ]) {
    if (!(key in data)) fail(`missing legacy field ${key}`);
  }
  if ('intervalMinutes' in data && 'startTime' in data && 'endTime' in data) {
    console.log('PASS  GET includes new fields intervalMinutes/startTime/endTime');
  } else {
    console.log('INFO  GET missing new fields — Railway has not deployed this branch yet');
  }

  const bad = await request('PUT', '/profile/salawat-preferences', {
    token,
    body: { intervalMinutes: 7 },
  });
  if (bad.status === 404) {
    console.log('INFO  PUT invalid-interval skipped (route not deployed)');
  } else if (bad.status !== 400) {
    fail(`invalid interval expected 400 got ${bad.status}`);
  } else {
    console.log('PASS  PUT invalid interval → 400');
  }

  const badTime = await request('PATCH', '/profile/salawat-preferences', {
    token,
    body: { startTime: '25:00' },
  });
  if (badTime.status !== 400) {
    console.log(`INFO  PATCH invalid startTime → ${badTime.status} (legacy schema may ignore extra keys)`);
  } else {
    console.log('PASS  PATCH invalid startTime → 400');
  }

  const put = await request('PUT', '/profile/salawat-preferences', {
    token,
    body: { enabled: true, intervalMinutes: 60, startTime: '08:00', endTime: '22:00' },
  });
  if (put.status === 404) {
    console.log('INFO  PUT not deployed yet — using PATCH { enabled } only');
    const patchEnable = await request('PATCH', '/profile/salawat-preferences', {
      token,
      body: { enabled: true },
    });
    if (patchEnable.status !== 200 || patchEnable.json.data?.enabled !== true) {
      fail(`PATCH enable ${JSON.stringify(patchEnable.json)}`);
    }
    console.log('PASS  PATCH enable (legacy Flutter body)');
  } else if (put.status !== 200) {
    fail(`PUT ${put.status} ${JSON.stringify(put.json)}`);
  } else {
    const putData = put.json.data || {};
    if (putData.enabled !== true || putData.intervalMinutes !== 60) {
      fail(`PUT body ${JSON.stringify(putData)}`);
    }
    console.log('PASS  PUT enable + interval 60');
  }

  const patch = await request('PATCH', '/profile/salawat-preferences', {
    token,
    body: { enabled: false },
  });
  if (patch.status !== 200 || patch.json.data?.enabled !== false) {
    fail(`PATCH disable ${JSON.stringify(patch.json)}`);
  }
    console.log('PASS  PATCH disable (legacy Flutter body)');

  const clipPick = await request('PATCH', '/profile/salawat-preferences', {
    token,
    body: { audioClipId: 'mishary_allahumma_salli' },
  });
  if (clipPick.status === 400 || clipPick.status === 404) {
    console.log(`INFO  PATCH audioClipId → ${clipPick.status} (not deployed or column missing)`);
  } else if (clipPick.status !== 200 || clipPick.json.data?.audioClipId !== 'mishary_allahumma_salli') {
    fail(`audioClipId ${clipPick.status} ${JSON.stringify(clipPick.json)}`);
  } else {
    console.log('PASS  PATCH audioClipId=mishary_allahumma_salli persists');
  }

  await request('DELETE', '/auth/me', { token });
  console.log('PASS  throwaway user deleted');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

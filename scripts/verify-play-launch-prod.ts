/**
 * Production Play-launch probes (read-only unless LIVE_SMOKE=1).
 *   npx tsx scripts/verify-play-launch-prod.ts
 *   LIVE_SMOKE=1 npx tsx scripts/verify-play-launch-prod.ts
 */
const API_BASE = (
  process.env.API_BASE ||
  'https://noorapp-backend-production.up.railway.app/api/v1'
).replace(/\/$/, '');

type Envelope = {
  success?: boolean;
  code?: string;
  data?: Record<string, unknown> | null;
  message?: string;
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
    json = { message: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

async function main(): Promise<void> {
  let failed = 0;
  const check = (name: string, ok: boolean, detail?: string) => {
    if (ok) console.log(`PASS  ${name}`);
    else {
      failed += 1;
      console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
  };

  console.log(`API_BASE=${API_BASE}`);

  const health = await request('GET', '/health');
  check(
    'GET /health is 200',
    health.status === 200,
    `${health.status} ${JSON.stringify(health.json).slice(0, 200)}`,
  );
  const fcm = (health.json.data as { fcm?: { configured?: boolean } } | undefined)?.fcm;
  const email = (health.json.data as { email?: { readyForDelivery?: boolean } } | undefined)?.email;
  console.log(`INFO  health.fcm.configured=${String(fcm?.configured)}`);
  console.log(`INFO  health.email.readyForDelivery=${String(email?.readyForDelivery)}`);

  const unauthDelete = await request('DELETE', '/auth/me');
  check(
    'DELETE /auth/me without token → 401 (route exists)',
    unauthDelete.status === 401,
    `${unauthDelete.status} ${unauthDelete.json.code || unauthDelete.json.message}`,
  );

  const cron = await request('POST', '/cron/prayer-reminders');
  check(
    'POST /cron/prayer-reminders without secret → 401',
    cron.status === 401,
    `${cron.status} ${cron.json.code || cron.json.message}`,
  );

  if (process.env.LIVE_SMOKE === '1' && unauthDelete.status === 401) {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync('npx', ['tsx', 'scripts/smoke-account-delete.ts'], {
      env: { ...process.env, API_BASE },
      stdio: 'inherit',
      shell: true,
    });
    check('LIVE_SMOKE account-delete', r.status === 0);
  } else {
    console.log('INFO  skip full signup+delete smoke (set LIVE_SMOKE=1 to run against this API_BASE)');
  }

  if (failed > 0) process.exit(1);
  console.log('\nPlay-launch production probes passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Account-deletion smoke (Google Play P0).
 *
 * Local:
 *   npx tsx scripts/smoke-account-delete.ts
 *
 * Production (creates then immediately hard-deletes a throwaway user):
 *   API_BASE=https://noorapp-backend-production.up.railway.app/api/v1 \
 *     npx tsx scripts/smoke-account-delete.ts
 */
const API_BASE = (
  process.env.API_BASE ||
  'https://noorapp-backend-production.up.railway.app/api/v1'
).replace(/\/$/, '');

type Envelope = {
  success?: boolean;
  message?: string;
  code?: string;
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
  });
  const text = await res.text();
  let json: Envelope = {};
  try {
    json = text ? (JSON.parse(text) as Envelope) : {};
  } catch {
    json = { message: text };
  }
  return { status: res.status, json };
}

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const stamp = Date.now();
  const email = `play-delete-${stamp}@example.com`;
  const password = 'PlayDelete123!';

  console.log(`API_BASE=${API_BASE}`);
  console.log(`Creating throwaway user ${email}`);

  const signup = await request('POST', '/auth/sign-up', {
    body: { fullName: 'Play Delete Smoke', email, password },
  });
  if (signup.status !== 201 || !signup.json.success) {
    fail(`sign-up expected 201, got ${signup.status} ${JSON.stringify(signup.json)}`);
  }

  const data = signup.json.data as {
    tokens?: { accessToken?: string; refreshToken?: string };
  };
  const accessToken = data.tokens?.accessToken;
  const refreshToken = data.tokens?.refreshToken;
  if (!accessToken || !refreshToken) {
    fail('sign-up missing tokens.accessToken / tokens.refreshToken');
  }

  const del = await request('DELETE', '/auth/me', { token: accessToken });
  if (del.status !== 200 || del.json.data?.deleted !== true) {
    fail(`DELETE /auth/me expected 200 deleted:true, got ${del.status} ${JSON.stringify(del.json)}`);
  }
  if (typeof del.json.data?.deletedAt !== 'string') {
    fail(`DELETE /auth/me missing deletedAt: ${JSON.stringify(del.json)}`);
  }
  console.log('PASS  DELETE /auth/me → 200 { deleted: true, deletedAt }');

  const me = await request('GET', '/auth/me', { token: accessToken });
  if (me.status !== 401) {
    fail(`GET /auth/me after delete expected 401, got ${me.status}`);
  }
  console.log('PASS  GET /auth/me after delete → 401');

  const login = await request('POST', '/auth/login', { body: { email, password } });
  if (login.status !== 401) {
    fail(`POST /auth/login after delete expected 401, got ${login.status} ${JSON.stringify(login.json)}`);
  }
  console.log('PASS  POST /auth/login after delete → 401');

  const refresh = await request('POST', '/auth/refresh', { body: { refreshToken } });
  if (refresh.status !== 401) {
    fail(`POST /auth/refresh after delete expected 401, got ${refresh.status}`);
  }
  console.log('PASS  POST /auth/refresh after delete → 401');

  const delAgain = await request('DELETE', '/auth/me', { token: accessToken });
  if (delAgain.status !== 401) {
    fail(`second DELETE /auth/me expected 401, got ${delAgain.status}`);
  }
  console.log('PASS  second DELETE /auth/me → 401 (already gone)');

  console.log('\nAccount deletion smoke passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

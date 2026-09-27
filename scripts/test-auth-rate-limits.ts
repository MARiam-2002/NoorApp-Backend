/**
 * Auth rate limits must not lock out real users sharing one carrier IP (CGNAT),
 * while still blocking brute force per account. Same 429 envelope as before.
 * Run: npx tsx scripts/test-auth-rate-limits.ts
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hardDeleteUserAccount } from '../src/services/auth.service';

async function main() {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/auth`;
  const stamp = Date.now();
  const createdEmails: string[] = [];

  async function post(path: string, body: unknown) {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  }

  try {
    console.log('--- many different users fail login from one IP: no 429 ---');
    for (let i = 0; i < 20; i += 1) {
      const r = await post('/login', { email: `rl-other-${i}-${stamp}@noor-test.local`, password: 'Wrong123!' });
      assert.equal(r.status, 401, `user ${i} should get 401, not ${r.status}`);
    }

    console.log('--- brute force on one account: 429 after 10 failures ---');
    const victim = `rl-victim-${stamp}@noor-test.local`;
    for (let i = 0; i < 10; i += 1) {
      assert.equal((await post('/login', { email: victim, password: 'Wrong123!' })).status, 401);
    }
    const blocked = await post('/login', { email: victim, password: 'Wrong123!' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.json.success, false);
    assert.equal(blocked.json.code, 'RATE_LIMIT_EXCEEDED');
    assert.equal(typeof blocked.json.message, 'string');
    assert.equal(typeof blocked.json.requestId, 'string');

    console.log('--- other accounts on the same IP still work ---');
    const realEmail = `rl-real-${stamp}@noor-test.local`;
    createdEmails.push(realEmail);
    const signUp = await post('/sign-up', { fullName: 'Rate Limit', email: realEmail, password: 'RateLimit123!' });
    assert.equal(signUp.status, 201);

    console.log('--- successful logins never count toward the limit ---');
    for (let i = 0; i < 15; i += 1) {
      const r = await post('/login', { email: realEmail, password: 'RateLimit123!' });
      assert.equal(r.status, 200, `successful login ${i} got ${r.status}`);
      assert.ok(r.json.data?.tokens?.accessToken);
    }

    console.log('--- forgot-password: 5 per email per hour, other emails unaffected ---');
    const inbox = `rl-reset-${stamp}@noor-test.local`;
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await post('/forgot-password', { email: inbox })).status, 200);
    }
    assert.equal((await post('/forgot-password', { email: inbox })).status, 429);
    assert.equal((await post('/forgot-password', { email: `rl-reset2-${stamp}@noor-test.local` })).status, 200);

    console.log('auth rate limits: OK');
  } finally {
    const users = await prisma.user.findMany({ where: { email: { in: createdEmails } }, select: { id: true } });
    for (const u of users) await hardDeleteUserAccount(u.id, { blockIdentity: false });
    server.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

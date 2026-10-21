import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import express from 'express';
import { env } from '../src/config';
import { assertSafeDatabaseTarget } from '../src/lib/database-safety';
import { prisma } from '../src/lib/prisma';
import { googleAudiences, verifyGoogleIdentity } from '../src/lib/google-identity';
import { changePassword } from '../src/services/profile.service';
import { generateAccessToken, hashPassword } from '../src/lib/auth';
import { apiClientKey } from '../src/middleware/http';
import { googleSignIn } from '../src/services/auth.service';
import { claimChallenge } from '../src/services/challenge.service';
import { calendarDayOfYear } from '../src/shared/utils/user-local-date';
import { isolatedReminderStage } from '../src/services/prayer-reminder.service';
import { cronRouter } from '../src/routes/cron';
import { passwordFieldSchema } from '../src/lib/validation';

async function main() {
  const config = { ...env };
  const certGetter = OAuth2Client.prototype.getFederatedSignonCertsAsync;
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const audience = 'test-noor.apps.googleusercontent.com';
  const sign = (extra = {}, key = privateKey) => jwt.sign({
    sub: 'test-sub', email: 'identity@example.invalid', email_verified: true,
    iss: 'https://accounts.google.com', aud: audience, ...extra,
  }, key, { algorithm: 'RS256', keyid: 'test-key', expiresIn: 3600 });
  // Real SDK signature/issuer/audience/expiry verification, with only Google's key fetch mocked.
  OAuth2Client.prototype.getFederatedSignonCertsAsync = (async () => ({ certs: {
    'test-key': publicKey.export({ type: 'spki', format: 'pem' }),
  }, format: 'PEM' })) as any;
  const originalFind = prisma.user.findUnique;
  const originalDeleted = prisma.deletedIdentity.findFirst;
  try {
    env.GOOGLE_CLIENT_ID = ''; env.GOOGLE_SERVER_CLIENT_ID = ''; env.GOOGLE_CLIENT_IDS = '';
    await assert.rejects(verifyGoogleIdentity(sign()), (e: any) => e.statusCode === 503);
    env.GOOGLE_SERVER_CLIENT_ID = audience;
    assert.deepEqual(googleAudiences(), [audience]);
    assert.equal((await verifyGoogleIdentity(sign())).sub, 'test-sub');
    for (const extra of [{ aud: 'other-app' }, { aud: undefined }, { iss: 'https://attacker.invalid' }, { email_verified: false }, { email: '' }]) {
      await assert.rejects(verifyGoogleIdentity(sign(extra)), (e: any) => e.statusCode === 401);
    }
    const wrongKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    await assert.rejects(verifyGoogleIdentity(sign({}, wrongKey)), (e: any) => e.statusCode === 401);
    const expired = jwt.sign({ sub: 's', email: 'a@b.invalid', email_verified: true, aud: audience,
      iss: 'https://accounts.google.com', iat: 1, exp: 2 }, privateKey, { algorithm: 'RS256', keyid: 'test-key' });
    await assert.rejects(verifyGoogleIdentity(expired), (e: any) => e.statusCode === 401);
    prisma.deletedIdentity.findFirst = (async () => null) as any;
    prisma.user.findUnique = (async () => ({ id: 'u', provider: 'LOCAL', emailVerifiedAt: null })) as any;
    await assert.rejects(googleSignIn(sign()), (e: any) => e.statusCode === 409);
    const request = (token: string) => ({ headers: { authorization: `Bearer ${token}` }, ip: '192.0.2.1' }) as any;
    assert.equal(apiClientKey(request('random-token-one')), apiClientKey(request('random-token-two')));
    const valid = generateAccessToken({ userId: 'u', email: 'a@b.invalid' });
    assert.notEqual(apiClientKey(request(valid)), apiClientKey(request('random-token-one')));
    assert.equal(passwordFieldSchema.safeParse('123456').success, false);
    assert.equal(passwordFieldSchema.safeParse('StrongPass123!').success, true);
  } finally {
    Object.assign(env, config);
    OAuth2Client.prototype.getFederatedSignonCertsAsync = certGetter;
    prisma.user.findUnique = originalFind;
    prisma.deletedIdentity.findFirst = originalDeleted;
  }

  const oldPasswordFind = prisma.user.findUnique;
  const oldPasswordTx = prisma.$transaction;
  let revoked = 0;
  try {
    const hashed = await hashPassword('CurrentPass123!');
    prisma.user.findUnique = (async () => ({ id: 'u', password: hashed })) as any;
    prisma.$transaction = (async (run: any) => run({
      user: { updateMany: async () => ({ count: 1 }) },
      refreshToken: { updateMany: async () => { revoked++; return { count: 2 }; } },
    })) as any;
    await assert.rejects(changePassword('u', { currentPassword: 'wrong', newPassword: 'NextPass123!' }), (e: any) => e.statusCode === 401);
    assert.equal(revoked, 0);
    await changePassword('u', { currentPassword: 'CurrentPass123!', newPassword: 'NextPass123!' });
    assert.equal(revoked, 1, 'A successful password change revokes sessions inside the same transaction');
  } finally { prisma.user.findUnique = oldPasswordFind; prisma.$transaction = oldPasswordTx; }

  const oldDate = globalThis.Date;
  let clock = Date.parse('2026-10-20T12:00:00Z');
  globalThis.Date = class extends oldDate {
    constructor(value?: any) { super(value ?? clock); }
    static now() { return clock; }
  } as any;
  const originals = {
    update: prisma.user.update, find: prisma.user.findUnique, tx: prisma.$transaction, template: prisma.dailyChallengeTemplate.findFirst,
    journey: prisma.dailyProgress.upsert, prayers: prisma.prayerCompletion.findMany, notification: prisma.notification.create,
  };
  let points = 0;
  const claims = new Map<string, any>();
  let tail = Promise.resolve();
  try {
    prisma.user.findUnique = (async () => ({ timezone: 'Africa/Cairo' })) as any;
    prisma.user.update = (async () => ({})) as any;
    prisma.dailyChallengeTemplate.findFirst = (async () => ({ type: 'QURAN_PAGES', targetValue: 1, rewardPoints: 50 })) as any;
    prisma.dailyProgress.upsert = (async () => ({ quranPagesRead: 1, adhkarCompleted: false, sadaqahAmount: 0 })) as any;
    prisma.prayerCompletion.findMany = (async () => []) as any;
    prisma.notification.create = (async () => ({})) as any;
    // Simulate account row serialization; no production DB is contacted.
    prisma.$transaction = ((run: any) => {
      const task = tail.then(() => run({
        $queryRaw: async () => [{ id: 'u' }],
        challengeCompletion: {
          findUnique: async (args: any) => claims.get(JSON.stringify(args.where)),
          upsert: async (args: any) => { claims.set(JSON.stringify(args.where), args.create); return args.create; },
        },
        user: { update: async (args: any) => { points += args.data.points.increment; return { points, level: 1 }; } },
      }));
      tail = task.then(() => undefined, () => undefined);
      return task;
    }) as any;
    const today = calendarDayOfYear(new Date('2026-10-20T00:00:00Z'));
    for (const id of ['0', '367', 'NaN', String(today - 1), String(today + 1)]) {
      await assert.rejects(claimChallenge('u', id), (e: any) => e.statusCode === 400);
    }
    const concurrent = await Promise.allSettled(Array.from({ length: 12 }, () => claimChallenge('u', String(today))));
    assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(points, 50);
    clock = oldDate.parse('2027-10-20T12:00:00Z');
    await claimChallenge('u', String(today));
    assert.equal(points, 100, 'Same day-of-year in next year is independent');
    assert.equal(claims.size, 2);
  } finally {
    globalThis.Date = oldDate;
    prisma.user.update = originals.update; prisma.user.findUnique = originals.find; prisma.$transaction = originals.tx;
    prisma.dailyChallengeTemplate.findFirst = originals.template; prisma.dailyProgress.upsert = originals.journey;
    prisma.prayerCompletion.findMany = originals.prayers; prisma.notification.create = originals.notification;
  }
  assert.throws(() => assertSafeDatabaseTarget('postgres://x:y@production.proxy.rlwy.net/railway', 'development'));
  assert.doesNotThrow(() => assertSafeDatabaseTarget('postgres://x:y@localhost/noor_test', 'test'));
  assert.doesNotThrow(() => assertSafeDatabaseTarget('postgres://x:y@isolated.invalid/noor_test', 'test'));
  const failed = await isolatedReminderStage('test', async () => { throw new Error('simulated'); });
  assert.equal(failed.pushesAttempted, 0);
  assert.equal((await isolatedReminderStage('next', async () => ({ ok: true })) as any).ok, true);
  const app = express(); app.use('/cron', cronRouter);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(r => server.once('listening', r));
    const port = (server.address() as any).port;
    assert.equal((await fetch(`http://127.0.0.1:${port}/cron/cleanup-users-without-fcm`, { method: 'POST' })).status, 404);
  } finally { await new Promise<void>(r => server.close(() => r())); }
  console.log('Security regression checks passed: real SDK JWT checks, fail-closed audience aliases, local-link protection, invalid-token limiter, password policy, annual/current-day concurrent claim logic, stage isolation and removed destructive HTTP route. DB concurrency is simulated; no production writes/pushes.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });

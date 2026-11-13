/**
 * Google sign-in must never 409 on duplicate display names.
 * Run: npx tsx scripts/test-google-username-unique.ts
 */
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import * as authService from '../src/services/auth.service';
import { env } from '../src/config';
import { OAuth2Client } from 'google-auth-library';

// Google ID tokens are verified by google-auth-library (signature, issuer, expiry, audience). The test replaces that
// verification with a fixed payload for a test audience, so no network and no real Google credentials are used.
const TEST_AUDIENCE = 'noor-test-client.apps.googleusercontent.com';
(env as { GOOGLE_CLIENT_IDS: string }).GOOGLE_CLIENT_IDS = TEST_AUDIENCE;

function mockGoogle(payload: { email: string; sub: string; name: string }) {
  OAuth2Client.prototype.verifyIdToken = (async () => ({
    getPayload: () => ({ ...payload, email_verified: true, aud: TEST_AUDIENCE, iss: 'https://accounts.google.com' }),
  })) as unknown as OAuth2Client['verifyIdToken'];
}

async function main() {
  const stamp = Date.now();
  const emails: string[] = [];
  const name = `Dup Name ${stamp}`;

  try {
    for (const i of [1, 2]) {
      const email = `google-dup-${i}-${stamp}@noor-test.local`;
      emails.push(email);
      mockGoogle({ email, sub: `sub-dup-${i}-${stamp}`, name });
      const r = await authService.googleSignIn('fake-id-token');
      assert.equal(r.user.email, email);
      assert.equal(r.user.fullName, name);
    }
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { username: true },
    });
    assert.equal(users.length, 2);
    assert.notEqual(users[0].username, users[1].username);

    const arabicEmail = `google-ar-${stamp}@noor-test.local`;
    emails.push(arabicEmail);
    mockGoogle({ email: arabicEmail, sub: `sub-ar-${stamp}`, name: 'مريم خالد' });
    const ar = await authService.googleSignIn('fake-id-token');
    assert.equal(ar.user.fullName, 'مريم خالد');
    assert.match(ar.user.username, /^google_ar_/);

    console.log('google username uniqueness: OK', users.map((u) => u.username), ar.user.username);
  } finally {

    const rows = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    for (const { id } of rows) {
      await authService.hardDeleteUserAccount(id, { blockIdentity: false });
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

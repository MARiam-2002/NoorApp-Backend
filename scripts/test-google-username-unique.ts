/**
 * Google sign-in must never 409 on duplicate display names.
 * Run: npx tsx scripts/test-google-username-unique.ts
 */
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import * as authService from '../src/services/auth.service';

const realFetch = globalThis.fetch;

function mockGoogle(payload: { email: string; sub: string; name: string }) {
  globalThis.fetch = (async (input: any, init?: any) => {
    if (String(input).includes('googleapis.com/oauth2/v3/tokeninfo')) {
      return new Response(JSON.stringify(payload), { status: 200 });
    }
    return realFetch(input, init);
  }) as typeof fetch;
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
    globalThis.fetch = realFetch;
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

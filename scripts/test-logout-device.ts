import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { generateRefreshToken } from '../src/lib/auth';
import { logout } from '../src/services/auth.service';

async function main() {
  const transaction = prisma.$transaction, update = prisma.refreshToken.updateMany;
  const devices = new Map([['own-device', 'owner'], ['other-device', 'other']]);
  let transactions = 0, revocations = 0;
  prisma.refreshToken.updateMany = (async () => { revocations++; return { count: 1 }; }) as any;
  prisma.$transaction = (async (callback: any) => {
    transactions++;
    return callback({
      refreshToken: { updateMany: async ({where}: any) => { assert.equal(where.userId, 'owner'); assert.ok(where.tokenHash); revocations++; return {count:1}; } },
      deviceToken: { deleteMany: async ({where}: any) => {
        assert.equal(where.userId, 'owner');
        if (devices.get(where.token) === where.userId) { devices.delete(where.token); return {count:1}; }
        return {count:0};
      } },
    });
  }) as any;
  try {
    const token = generateRefreshToken({ userId: 'owner', email: 'test@example.com' });
    await logout({ refreshToken: 'invalid', fcmToken: 'own-device' });
    assert.equal(transactions, 0); assert.ok(devices.has('own-device'));
    await logout({ refreshToken: token, fcmToken: 'other-device' });
    assert.ok(devices.has('other-device'), 'never remove a token belonging to another account');
    await logout({ refreshToken: token, fcmToken: 'own-device' });
    assert.ok(!devices.has('own-device'));
    await logout({ refreshToken: token });
    assert.equal(revocations, 3, 'legacy refresh-only logout remains supported');
    console.log('Logout device regression passed: signed refresh ownership, atomic revoke/unregister, foreign-device protection and legacy contract. Mock DB; no production writes.');
  } finally { prisma.$transaction = transaction; prisma.refreshToken.updateMany = update; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

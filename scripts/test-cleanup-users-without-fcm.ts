/**
 * Unit + DB tests for cleanup of users with zero valid FCM devices.
 * Run: npx tsx scripts/test-cleanup-users-without-fcm.ts
 *
 * SAFETY: never runs bulk real cleanup against the whole DB.
 * Real-delete coverage uses hardDeleteUserAccount on a single doomed test user only.
 */
import assert from 'node:assert/strict';
import '../src/load-env';
import { prisma } from '../src/lib/prisma';
import * as authService from '../src/services/auth.service';
import {
  cleanupUsersWithoutFcm,
  isValidFcmTokenValue,
  userHasValidFcmDevice,
  findUsersWithNoValidFcmDevice,
  REAL_DELETE_CONFIRM_PHRASE,
  NO_VALID_FCM_DEVICE_REASON,
} from '../src/services/cleanup-users-without-fcm.service';

async function main() {
  console.log('--- unit: isValidFcmTokenValue ---');
  assert.equal(isValidFcmTokenValue(null), false);
  assert.equal(isValidFcmTokenValue(undefined), false);
  assert.equal(isValidFcmTokenValue(''), false);
  assert.equal(isValidFcmTokenValue('   '), false);
  assert.equal(isValidFcmTokenValue('short'), false);
  assert.equal(isValidFcmTokenValue('123456789'), false);
  assert.equal(isValidFcmTokenValue('1234567890'), true);
  assert.equal(isValidFcmTokenValue('  validtoken12  '), true);

  console.log('--- unit: real path guards ---');
  await assert.rejects(
    () => cleanupUsersWithoutFcm({ dryRun: false, confirm: 'wrong' }),
    /Refusing real deletion/,
  );
  await assert.rejects(
    () =>
      cleanupUsersWithoutFcm({
        dryRun: false,
        confirm: REAL_DELETE_CONFIRM_PHRASE,
      }),
    /without LIMIT/,
  );
  await assert.rejects(
    () =>
      cleanupUsersWithoutFcm({
        dryRun: false,
        confirm: REAL_DELETE_CONFIRM_PHRASE,
        limit: 100,
        allowBulk: false,
      }),
    /allowBulk/,
  );

  if (!process.env.DATABASE_URL) {
    console.log('SKIP DB tests — DATABASE_URL not set');
    console.log('cleanup-users-without-fcm tests: OK (unit only)');
    return;
  }

  const stamp = Date.now();
  const createdIds: string[] = [];

  async function signup(label: string) {
    const r = await authService.signUp({
      fullName: label,
      email: `nofcm-${label}-${stamp}@example.com`,
      password: 'NoFcmTest123!',
    });
    createdIds.push(r.user.id);
    return r.user.id;
  }

  try {
    console.log('--- DB: eligibility matrix ---');
    const zeroDevices = await signup('zero');

    const oneValid = await signup('onevalid');
    await prisma.deviceToken.create({
      data: {
        userId: oneValid,
        token: `valid-token-${stamp}-abcdefghij`,
        platform: 'android',
      },
    });

    const multiOneValid = await signup('multi');
    await prisma.deviceToken.create({
      data: {
        userId: multiOneValid,
        token: `multi-a-${stamp}-abcdefghij`,
        platform: 'android',
      },
    });

    const emptyToken = await signup('empty');
    await prisma.deviceToken.create({
      data: { userId: emptyToken, token: '', platform: 'android' },
    });

    const wsToken = await signup('ws');
    await prisma.deviceToken.create({
      data: { userId: wsToken, token: '   ', platform: 'ios' },
    });

    const shortToken = await signup('short');
    await prisma.deviceToken.create({
      data: { userId: shortToken, token: 'abc', platform: 'ios' },
    });

    assert.equal(await userHasValidFcmDevice(zeroDevices), false);
    assert.equal(await userHasValidFcmDevice(oneValid), true);
    assert.equal(await userHasValidFcmDevice(multiOneValid), true);
    assert.equal(await userHasValidFcmDevice(emptyToken), false);
    assert.equal(await userHasValidFcmDevice(wsToken), false);
    assert.equal(await userHasValidFcmDevice(shortToken), false);

    const eligible = await findUsersWithNoValidFcmDevice({});
    const eligibleIds = new Set(eligible.map((u) => u.id));
    assert.ok(eligibleIds.has(zeroDevices));
    assert.ok(eligibleIds.has(emptyToken));
    assert.ok(eligibleIds.has(wsToken));
    assert.ok(eligibleIds.has(shortToken));
    assert.ok(!eligibleIds.has(oneValid));
    assert.ok(!eligibleIds.has(multiOneValid));
    assert.ok(eligible.every((u) => u.reason === NO_VALID_FCM_DEVICE_REASON));

    console.log('--- DB: dry-run never deletes ---');
    const beforeCount = await prisma.user.count({ where: { id: { in: createdIds } } });
    const dry = await cleanupUsersWithoutFcm({ dryRun: true });
    assert.equal(dry.dryRun, true);
    assert.equal(dry.deletedUsers, 0);
    assert.ok(dry.eligibleUsers >= 4);
    assert.equal(
      await prisma.user.count({ where: { id: { in: createdIds } } }),
      beforeCount,
    );

    console.log('--- DB: race skip (token registered after scan) ---');
    const raceUser = await signup('race');
    assert.equal(await userHasValidFcmDevice(raceUser), false);
    const raceCleanup = await cleanupUsersWithoutFcm({
      dryRun: false,
      confirm: REAL_DELETE_CONFIRM_PHRASE,
      limit: 1,
      allowBulk: false,
      onlyUserIds: [raceUser],
      onAfterScan: async () => {
        await prisma.deviceToken.create({
          data: {
            userId: raceUser,
            token: `race-token-${stamp}-abcdefghij`,
            platform: 'android',
          },
        });
      },
    });
    assert.equal(raceCleanup.eligibleUsers, 1);
    assert.equal(raceCleanup.deletedUsers, 0);
    assert.equal(raceCleanup.raceSkippedUsers, 1);
    assert.equal(raceCleanup.skipped[0]?.reason, 'FCM_TOKEN_REGISTERED_AFTER_SCAN');
    assert.ok(await prisma.user.findUnique({ where: { id: raceUser } }));

    console.log('--- DB: single-user hardDelete (same path as /auth/me) ---');
    const doomed = await signup('doomed');
    await prisma.notification.create({
      data: {
        userId: doomed,
        titleAr: 'ت',
        titleEn: 't',
        bodyAr: 'ب',
        bodyEn: 'b',
      },
    });
    await authService.hardDeleteUserAccount(doomed);
    assert.equal(await prisma.user.findUnique({ where: { id: doomed } }), null);
    assert.equal(await prisma.notification.count({ where: { userId: doomed } }), 0);
    assert.equal(await prisma.deviceToken.count({ where: { userId: doomed } }), 0);

    assert.ok(await prisma.user.findUnique({ where: { id: oneValid } }));
    assert.ok(await prisma.user.findUnique({ where: { id: multiOneValid } }));
    assert.ok(await prisma.user.findUnique({ where: { id: raceUser } }));

    console.log('--- DB: limited real cleanup scoped to doomed2 only ---');
    const doomed2 = await signup('doomed2');
    const limited = await cleanupUsersWithoutFcm({
      dryRun: false,
      confirm: REAL_DELETE_CONFIRM_PHRASE,
      limit: 1,
      allowBulk: false,
      onlyUserIds: [doomed2],
    });
    assert.equal(limited.deletedUsers, 1);
    assert.deepEqual(limited.deletedIds, [doomed2]);
    assert.ok(await prisma.user.findUnique({ where: { id: oneValid } }));

    console.log('--- DB: deleteAccount (/auth/me) unchanged ---');
    const playUser = await signup('playpath');
    await prisma.deviceToken.create({
      data: {
        userId: playUser,
        token: `play-${stamp}-abcdefghij`,
        platform: 'android',
      },
    });
    const playResult = await authService.deleteAccount(playUser);
    assert.equal(playResult.deleted, true);
    assert.equal(await prisma.user.findUnique({ where: { id: playUser } }), null);

    console.log('cleanup-users-without-fcm tests: OK');
  } finally {
    for (const id of createdIds) {
      try {
        const u = await prisma.user.findUnique({ where: { id } });
        if (u) await authService.hardDeleteUserAccount(id);
      } catch {
        /* ignore */
      }
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

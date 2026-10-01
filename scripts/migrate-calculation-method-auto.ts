/**
 * One-off data fix: users still on the old product default (Egyptian method) move to AUTO,
 * so prayer times and Azan pushes follow the official method of the country they are in
 * (e.g. Umm Al-Qura in Saudi Arabia). In Egypt AUTO resolves to the same Egyptian method.
 * Users who picked any other method are untouched. Safe to re-run.
 *
 * Usage: npx tsx scripts/migrate-calculation-method-auto.ts            (dry run)
 *        npx tsx scripts/migrate-calculation-method-auto.ts --apply    (writes)
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { autoCalculationMethodFor } from '../src/shared/utils/auto-calculation-method';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const OLD_DEFAULTS = new Set(['EGYPT', 'EGYPTIAN', 'EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY']);

const isOldDefault = (v: unknown) => typeof v === 'string' && OLD_DEFAULTS.has(v.trim().toUpperCase());

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, prayerCalculationMethod: true, azanPreferences: true, latitude: true, longitude: true },
  });

  const plans: { id: string; data: Prisma.UserUpdateInput }[] = [];
  const effective: Record<string, number> = {};
  for (const u of users) {
    const prefs =
      u.azanPreferences && typeof u.azanPreferences === 'object' && !Array.isArray(u.azanPreferences)
        ? (u.azanPreferences as Record<string, unknown>)
        : null;
    const columnOld = isOldDefault(u.prayerCalculationMethod);
    const prefsOld = prefs != null && isOldDefault(prefs.calculationMethod);
    const prefsPicked = prefs != null && typeof prefs.calculationMethod === 'string' && !prefsOld;
    if (prefsPicked || (!columnOld && !prefsOld)) continue;

    const data: Prisma.UserUpdateInput = { prayerCalculationMethod: 'AUTO' };
    if (prefsOld) data.azanPreferences = { ...prefs, calculationMethod: 'AUTO' } as Prisma.InputJsonObject;
    plans.push({ id: u.id, data });

    const lat = (prefs?.lastLat as number | undefined) ?? u.latitude;
    const lng = (prefs?.lastLng as number | undefined) ?? u.longitude;
    const key = lat != null && lng != null ? autoCalculationMethodFor(lat, lng) : 'EGYPT (no location, Cairo default)';
    effective[key] = (effective[key] ?? 0) + 1;
  }

  console.log(`users: ${users.length}, to move to AUTO: ${plans.length}`);
  console.log('resulting method by location:', effective);
  if (!apply) {
    console.log('Dry run — re-run with --apply to write.');
    return;
  }
  for (const p of plans) {
    await prisma.user.update({ where: { id: p.id }, data: p.data, select: { id: true } });
  }
  console.log(`Done — ${plans.length} users updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

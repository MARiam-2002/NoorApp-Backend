/**
 * Upsert curated stance catalog into DB + attach answers FK.
 * Usage: npx tsx src/scripts/seed-stances.ts
 */
import process from 'node:process';
import { prisma } from '../lib/prisma';
import {
  STANCE_SEED_ROWS,
  stanceSeedId,
} from '../shared/constants/stance-situations';

async function main() {
  console.log(`Seeding ${STANCE_SEED_ROWS.length} stance situations...`);
  for (const r of STANCE_SEED_ROWS) {
    const id = stanceSeedId(r.sortOrder);
    await prisma.stanceSituation.upsert({
      where: { id },
      create: {
        id,
        sortOrder: r.sortOrder,
        situationAr: r.situationAr,
        optionAAr: r.optionAAr,
        optionBAr: r.optionBAr,
        optionCAr: r.optionCAr,
        correctOptionKey: r.correctOptionKey,
        rulingAr: r.rulingAr,
        sourceAr: r.sourceAr,
        rewardPoints: r.rewardPoints ?? 15,
        isActive: true,
      },
      update: {
        sortOrder: r.sortOrder,
        situationAr: r.situationAr,
        optionAAr: r.optionAAr,
        optionBAr: r.optionBAr,
        optionCAr: r.optionCAr,
        correctOptionKey: r.correctOptionKey,
        rulingAr: r.rulingAr,
        sourceAr: r.sourceAr,
        rewardPoints: r.rewardPoints ?? 15,
        isActive: true,
      },
    });
  }

  await prisma.$executeRawUnsafe(`
    DELETE FROM "stance_answers"
    WHERE "situationId" NOT IN (SELECT "id" FROM "stance_situations")
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "stance_answers"
        ADD CONSTRAINT "stance_answers_situationId_fkey"
        FOREIGN KEY ("situationId") REFERENCES "stance_situations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  const count = await prisma.stanceSituation.count({ where: { isActive: true } });
  console.log(`Done. Active situations in DB: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

-- Stance situations catalog (answers FK added after seed in scripts/seed-stances.ts).
CREATE TABLE IF NOT EXISTS "stance_situations" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "situationAr" TEXT NOT NULL,
    "situationEn" TEXT,
    "optionAAr" TEXT NOT NULL,
    "optionBAr" TEXT NOT NULL,
    "optionCAr" TEXT NOT NULL,
    "correctOptionKey" TEXT NOT NULL,
    "rulingAr" TEXT NOT NULL,
    "rulingEn" TEXT,
    "sourceAr" TEXT NOT NULL,
    "rewardPoints" INTEGER NOT NULL DEFAULT 15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stance_situations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stance_situations_sortOrder_key"
  ON "stance_situations"("sortOrder");

CREATE INDEX IF NOT EXISTS "stance_situations_isActive_sortOrder_idx"
  ON "stance_situations"("isActive", "sortOrder");

-- Stance answers for "موقفك إيه؟" (catalog lives in app code).
CREATE TABLE IF NOT EXISTS "stance_answers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "situationId" TEXT NOT NULL,
    "selectedOptionKey" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stance_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stance_answers_userId_situationId_key"
  ON "stance_answers"("userId", "situationId");

CREATE INDEX IF NOT EXISTS "stance_answers_userId_answeredAt_idx"
  ON "stance_answers"("userId", "answeredAt");

DO $$ BEGIN
  ALTER TABLE "stance_answers"
    ADD CONSTRAINT "stance_answers_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

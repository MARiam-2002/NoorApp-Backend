-- Per-user Sadaqah goal (default 1000 EGP). Does not reset today's sadaqahAmount.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sadaqahGoal" DECIMAL(10,2) NOT NULL DEFAULT 1000;

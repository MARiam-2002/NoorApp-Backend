-- Optional per-category personal Sadaqah totals for the day (tracking only; no payments).
ALTER TABLE "daily_progress" ADD COLUMN IF NOT EXISTS "sadaqahBreakdown" JSONB;

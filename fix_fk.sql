-- Delete invalid records from daily_dhikr_completions where itemId doesn't exist
DELETE FROM daily_dhikr_completions
WHERE "itemId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM dhikr_items WHERE id = daily_dhikr_completions."itemId"
  );

-- Delete invalid records from daily_dhikr_completions where categoryId doesn't exist
DELETE FROM daily_dhikr_completions
WHERE "categoryId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM dhikr_categories WHERE id = daily_dhikr_completions."categoryId"
  );

SELECT 'Cleanup complete' as status;

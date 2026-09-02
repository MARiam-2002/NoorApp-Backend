-- Delete orphan records in daily_dhikr_completions where itemId doesn't exist in dhikr_items
DELETE FROM daily_dhikr_completions 
WHERE itemId IS NOT NULL 
AND itemId NOT IN (SELECT id FROM dhikr_items);

SELECT COUNT(*) as invalid_items
FROM daily_dhikr_completions ddc
LEFT JOIN dhikr_items di ON ddc."itemId" = di.id
WHERE ddc."itemId" IS NOT NULL AND di.id IS NULL;

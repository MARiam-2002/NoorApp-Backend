-- Spelling: the original adhkar category names began with «اذكار» (no hamza); the correct word is «أذكار».
-- Only that first letter changes, only on rows that still have it, so running it again changes nothing.
UPDATE "dhikr_categories"
SET "nameAr" = 'أ' || substring("nameAr" from 2), "updatedAt" = CURRENT_TIMESTAMP
WHERE "nameAr" LIKE 'اذكار %';

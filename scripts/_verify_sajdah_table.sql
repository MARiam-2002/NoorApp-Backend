SELECT COUNT(*)::text AS row_count FROM (SELECT 1)x;
SELECT COUNT(*)::text AS table_exists FROM information_schema.tables WHERE table_name = 'quran_sajdah_completions';
SELECT STRING_AGG(column_name || ':' || data_type, ', ' ORDER BY ordinal_position) AS cols FROM information_schema.columns WHERE table_name = 'quran_sajdah_completions';

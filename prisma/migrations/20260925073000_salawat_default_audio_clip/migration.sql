-- Align default Salawat audio clip id with the live catalog.
ALTER TABLE "users"
  ALTER COLUMN "salawatAudioClipId" SET DEFAULT 'salli_ala_muhammad_voice';

UPDATE "users"
SET "salawatAudioClipId" = 'salli_ala_muhammad_voice'
WHERE "salawatAudioClipId" IS NULL
   OR "salawatAudioClipId" = ''
   OR "salawatAudioClipId" = 'peaceful_reminder_tone';

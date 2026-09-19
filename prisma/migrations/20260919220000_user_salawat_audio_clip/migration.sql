-- Persist the user's selected Salawat / Prayer Upon the Prophet audio clip id.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "salawatAudioClipId" TEXT NOT NULL DEFAULT 'peaceful_reminder_tone';

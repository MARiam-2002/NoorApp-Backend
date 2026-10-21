-- What each installed app can play/display (channel schema version, bundled sound files,
-- supported FCM types). Nullable: old clients never send it and keep working unchanged.
ALTER TABLE "device_tokens" ADD COLUMN IF NOT EXISTS "capabilities" JSONB;

-- Home screen layout chosen by the user (section order/visibility and tool shortcuts), synced across devices.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "homeLayout" JSONB;

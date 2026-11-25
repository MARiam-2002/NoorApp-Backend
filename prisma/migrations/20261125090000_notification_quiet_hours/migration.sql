-- One quiet window for every reminder except the Adhan (GET/PATCH /profile/notification-quiet-hours).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notificationQuietHours" JSONB;

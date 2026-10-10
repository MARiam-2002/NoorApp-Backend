ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
CREATE TABLE "pending_registrations" (
 "id" TEXT PRIMARY KEY, "email" TEXT NOT NULL UNIQUE, "payload" JSONB NOT NULL,
 "codeHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "attempts" INTEGER NOT NULL DEFAULT 0, "sentCount" INTEGER NOT NULL DEFAULT 1,
 "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "pending_registrations_createdAt_idx" ON "pending_registrations"("createdAt");

-- Play account-deletion: remember email / Google sub so login and Google
-- cannot revive the deleted identity. Explicit POST /auth/sign-up with the
-- same email creates a new empty account and removes this row.
CREATE TABLE IF NOT EXISTS "deleted_identities" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleId" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "deleted_identities_email_key" ON "deleted_identities"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "deleted_identities_googleId_key" ON "deleted_identities"("googleId");
CREATE INDEX IF NOT EXISTS "deleted_identities_googleId_idx" ON "deleted_identities"("googleId");

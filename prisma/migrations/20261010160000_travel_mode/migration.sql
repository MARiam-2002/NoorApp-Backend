ALTER TABLE "users" ADD COLUMN "travelPreferences" JSONB;
CREATE TABLE "travel_operations" (
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "requestKey" TEXT NOT NULL, "fingerprint" TEXT NOT NULL, "result" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId", "requestKey")
);

ALTER TABLE "users" ADD COLUMN "fullName" TEXT;

ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE ("username");

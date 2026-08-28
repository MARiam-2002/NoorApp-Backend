-- CreateTable
CREATE TABLE IF NOT EXISTS "adhkar_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adhkar_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "adhkar_favorites_userId_itemId_key" ON "adhkar_favorites"("userId", "itemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "adhkar_favorites_userId_idx" ON "adhkar_favorites"("userId");

-- AddForeignKey
ALTER TABLE "adhkar_favorites" ADD CONSTRAINT "adhkar_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adhkar_favorites" ADD CONSTRAINT "adhkar_favorites_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "dhikr_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;


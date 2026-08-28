-- Create adhkar_favorites table if not exists
CREATE TABLE IF NOT EXISTS adhkar_favorites (
    id TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT adhkar_favorites_pkey PRIMARY KEY (id),
    CONSTRAINT adhkar_favorites_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT adhkar_favorites_itemId_fkey FOREIGN KEY ("itemId") REFERENCES dhikr_items(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS adhkar_favorites_userId_itemId_key ON adhkar_favorites("userId", "itemId");

-- Create index for userId
CREATE INDEX IF NOT EXISTS adhkar_favorites_userId_idx ON adhkar_favorites("userId");

SELECT 'adhkar_favorites table ready' as status;

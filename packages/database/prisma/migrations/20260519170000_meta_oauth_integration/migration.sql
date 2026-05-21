ALTER TABLE "SocialAccount"
ADD COLUMN IF NOT EXISTS "accountName" TEXT,
ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT,
ADD COLUMN IF NOT EXISTS "webhookStatus" TEXT NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS "MetaOAuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "encryptedPayload" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaOAuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MetaOAuthSession_state_key" ON "MetaOAuthSession"("state");
CREATE INDEX IF NOT EXISTS "MetaOAuthSession_userId_expiresAt_idx" ON "MetaOAuthSession"("userId", "expiresAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MetaOAuthSession_userId_fkey'
    ) THEN
        ALTER TABLE "MetaOAuthSession"
        ADD CONSTRAINT "MetaOAuthSession_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

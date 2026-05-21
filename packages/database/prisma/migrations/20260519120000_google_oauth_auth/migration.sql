-- Rename Clerk-era identity columns to provider-neutral Google auth fields
ALTER TABLE "User" RENAME COLUMN "clerkId" TO "authProviderId";
ALTER INDEX "User_clerkId_key" RENAME TO "User_authProviderId_key";

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "authProvider" TEXT NOT NULL DEFAULT 'google',
  ADD COLUMN IF NOT EXISTS "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "users_emailVerificationTokenHash_key";

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "emailVerifiedAt",
  DROP COLUMN IF EXISTS "emailVerificationTokenHash",
  DROP COLUMN IF EXISTS "emailVerificationExpiresAt";

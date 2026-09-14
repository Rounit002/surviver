ALTER TABLE "users"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationTokenHash" TEXT,
  ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_emailVerificationTokenHash_key"
  ON "users"("emailVerificationTokenHash");

ALTER TABLE "sessions" ADD COLUMN "absoluteExpiresAt" TIMESTAMP(3);
UPDATE "sessions" SET "absoluteExpiresAt" = "expiresAt" WHERE "absoluteExpiresAt" IS NULL;
ALTER TABLE "sessions" ALTER COLUMN "absoluteExpiresAt" SET NOT NULL;

ALTER TABLE "season_entries"
  ADD COLUMN "manageTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "manageTokenRevokedAt" TIMESTAMP(3);
UPDATE "season_entries"
SET "manageTokenExpiresAt" = NOW() + INTERVAL '90 days'
WHERE "manageToken" IS NOT NULL;

ALTER TABLE "payments"
  ADD COLUMN "providerCheckoutId" TEXT,
  ADD COLUMN "checkoutTokenHash" TEXT,
  ADD COLUMN "checkoutTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "refundRequestedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "payments_checkoutTokenHash_key" ON "payments"("checkoutTokenHash");

CREATE TABLE "rate_limit_buckets" (
  "key" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "rate_limit_buckets_expiresAt_idx" ON "rate_limit_buckets"("expiresAt");

CREATE TABLE "webhook_events" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "failureReason" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "webhook_events_provider_status_idx" ON "webhook_events"("provider", "status");
CREATE INDEX "webhook_events_receivedAt_idx" ON "webhook_events"("receivedAt");

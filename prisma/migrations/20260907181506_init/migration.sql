-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FOUNDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('AI', 'DEV_TOOLS', 'PRODUCTIVITY', 'MARKETING', 'DESIGN', 'FOUNDER_TOOLS', 'AUTOMATION', 'NO_CODE', 'ANALYTICS', 'CREATOR');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('AWAITING_PAYMENT', 'AWAITING_APPROVAL', 'REJECTED', 'UPCOMING', 'ACTIVE', 'ELIMINATED', 'FINALIST', 'SURVIVOR', 'DISQUALIFIED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('PENDING', 'ACTIVE', 'FINALIZING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CompetitiveStatus" AS ENUM ('COLLECTING_DATA', 'SAFE', 'RISING', 'DANGER', 'ELIMINATION_ZONE', 'ELIMINATED', 'FINALIST', 'SURVIVOR');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('DISCOVERY', 'RALLY', 'RALLY_SELF');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "xHandle" TEXT,
    "role" "Role" NOT NULL DEFAULT 'FOUNDER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "category" "ProductCategory" NOT NULL,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'DRAFT',
    "entryPriceCents" INTEGER NOT NULL DEFAULT 2900,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "capacity" INTEGER NOT NULL DEFAULT 32,
    "registrationStart" TIMESTAMP(3),
    "registrationEnd" TIMESTAMP(3),
    "seasonStart" TIMESTAMP(3),
    "seasonEnd" TIMESTAMP(3),
    "minSampleImpressions" INTEGER NOT NULL DEFAULT 250,
    "defaultRoundHours" INTEGER NOT NULL DEFAULT 24,
    "finalRoundHours" INTEGER NOT NULL DEFAULT 48,
    "rallyPointsPerStep" INTEGER NOT NULL DEFAULT 10,
    "rallyBonusPerStep" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "rallyBonusCap" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "impressionDedupSec" INTEGER NOT NULL DEFAULT 1800,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_entries" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "rallyCode" TEXT NOT NULL,
    "finalRank" INTEGER,
    "eliminatedRoundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "eliminationCount" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'PENDING',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_round_stats" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "seasonEntryId" TEXT NOT NULL,
    "qualifiedImpressions" INTEGER NOT NULL DEFAULT 0,
    "verifiedVisits" INTEGER NOT NULL DEFAULT 0,
    "discoveryVisits" INTEGER NOT NULL DEFAULT 0,
    "rallyVisits" INTEGER NOT NULL DEFAULT 0,
    "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rallyPoints" INTEGER NOT NULL DEFAULT 0,
    "suspiciousEvents" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "status" "CompetitiveStatus" NOT NULL DEFAULT 'COLLECTING_DATA',
    "prevRank" INTEGER,
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_round_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impression_events" (
    "id" TEXT NOT NULL,
    "seasonEntryId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL DEFAULT 'DISCOVERY',
    "dwellMs" INTEGER NOT NULL DEFAULT 0,
    "qualified" BOOLEAN NOT NULL DEFAULT true,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impression_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_events" (
    "id" TEXT NOT NULL,
    "seasonEntryId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL DEFAULT 'DISCOVERY',
    "qualifiesForScore" BOOLEAN NOT NULL DEFAULT true,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rally_visitors" (
    "id" TEXT NOT NULL,
    "referringEntryId" TEXT NOT NULL,
    "roundId" TEXT,
    "visitorId" TEXT NOT NULL,
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "qualifiedAt" TIMESTAMP(3),
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "otherProductsSeen" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rally_visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "seasonEntryId" TEXT,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "lastWebhookEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "roundId" TEXT,
    "seasonEntryId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_ownerId_idx" ON "products"("ownerId");

-- CreateIndex
CREATE INDEX "products_approvalStatus_idx" ON "products"("approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_number_key" ON "seasons"("number");

-- CreateIndex
CREATE UNIQUE INDEX "season_entries_rallyCode_key" ON "season_entries"("rallyCode");

-- CreateIndex
CREATE INDEX "season_entries_seasonId_status_idx" ON "season_entries"("seasonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "season_entries_seasonId_productId_key" ON "season_entries"("seasonId", "productId");

-- CreateIndex
CREATE INDEX "rounds_status_idx" ON "rounds"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_seasonId_roundNumber_key" ON "rounds"("seasonId", "roundNumber");

-- CreateIndex
CREATE INDEX "product_round_stats_roundId_rank_idx" ON "product_round_stats"("roundId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "product_round_stats_roundId_seasonEntryId_key" ON "product_round_stats"("roundId", "seasonEntryId");

-- CreateIndex
CREATE INDEX "impression_events_roundId_seasonEntryId_visitorId_createdAt_idx" ON "impression_events"("roundId", "seasonEntryId", "visitorId", "createdAt");

-- CreateIndex
CREATE INDEX "impression_events_roundId_createdAt_idx" ON "impression_events"("roundId", "createdAt");

-- CreateIndex
CREATE INDEX "click_events_roundId_seasonEntryId_visitorId_idx" ON "click_events"("roundId", "seasonEntryId", "visitorId");

-- CreateIndex
CREATE INDEX "click_events_roundId_createdAt_idx" ON "click_events"("roundId", "createdAt");

-- CreateIndex
CREATE INDEX "rally_visitors_referringEntryId_qualified_idx" ON "rally_visitors"("referringEntryId", "qualified");

-- CreateIndex
CREATE UNIQUE INDEX "rally_visitors_referringEntryId_visitorId_key" ON "rally_visitors"("referringEntryId", "visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_seasonEntryId_key" ON "payments"("seasonEntryId");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_providerPaymentId_key" ON "payments"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "admin_actions_targetType_targetId_idx" ON "admin_actions"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "admin_actions_createdAt_idx" ON "admin_actions"("createdAt");

-- CreateIndex
CREATE INDEX "activity_events_createdAt_idx" ON "activity_events"("createdAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_entries" ADD CONSTRAINT "season_entries_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_entries" ADD CONSTRAINT "season_entries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_entries" ADD CONSTRAINT "season_entries_eliminatedRoundId_fkey" FOREIGN KEY ("eliminatedRoundId") REFERENCES "rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_round_stats" ADD CONSTRAINT "product_round_stats_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_round_stats" ADD CONSTRAINT "product_round_stats_seasonEntryId_fkey" FOREIGN KEY ("seasonEntryId") REFERENCES "season_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impression_events" ADD CONSTRAINT "impression_events_seasonEntryId_fkey" FOREIGN KEY ("seasonEntryId") REFERENCES "season_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impression_events" ADD CONSTRAINT "impression_events_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_seasonEntryId_fkey" FOREIGN KEY ("seasonEntryId") REFERENCES "season_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rally_visitors" ADD CONSTRAINT "rally_visitors_referringEntryId_fkey" FOREIGN KEY ("referringEntryId") REFERENCES "season_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_seasonEntryId_fkey" FOREIGN KEY ("seasonEntryId") REFERENCES "season_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_seasonEntryId_fkey" FOREIGN KEY ("seasonEntryId") REFERENCES "season_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

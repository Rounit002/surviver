-- The format: exactly 32 products. Nothing starts until all 32 are paid, and
-- once they are, every product stays on the board for the whole season and is
-- ranked by clicks. No eliminations.

-- 1. Exactly 32 spots, enforced by the database rather than by whichever seed
--    or script last touched the row. The earlier 35 -> 32 migration only
--    covered open and closed seasons, so a DRAFT season could still carry 35.
UPDATE "seasons"
SET "capacity" = 32
WHERE "capacity" <> 32
  AND "status" IN ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED');

-- Seasons that already ran keep whatever field they actually played with.
ALTER TABLE "seasons"
  ADD CONSTRAINT "seasons_capacity_is_32"
  CHECK ("capacity" = 32 OR "status" IN ('RUNNING', 'COMPLETED', 'CANCELLED'));

-- 2. One ranking window per season instead of a chain of elimination rounds.
ALTER TABLE "seasons" ADD COLUMN "seasonLengthHours" INTEGER NOT NULL DEFAULT 720;
ALTER TABLE "seasons"
  ADD CONSTRAINT "seasons_length_positive" CHECK ("seasonLengthHours" > 0);

-- 3. Where every non-winner lands when the season ends.
ALTER TYPE "EntryStatus" ADD VALUE 'FINISHED' AFTER 'SURVIVOR';

-- 4. Owed refunds (a payment that landed on a full or closed season) are
--    retried until the provider accepts them.
ALTER TABLE "payments" ADD COLUMN "refundSentAt" TIMESTAMP(3);

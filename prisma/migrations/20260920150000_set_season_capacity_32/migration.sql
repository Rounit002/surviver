ALTER TABLE "seasons" ALTER COLUMN "capacity" SET DEFAULT 32;

-- The new season format has a 32-product field. Apply it to seasons that
-- have not started yet; active and completed seasons keep their stored rules.
UPDATE "seasons"
SET "capacity" = 32
WHERE "capacity" = 35
  AND "status" IN ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED');

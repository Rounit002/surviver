ALTER TABLE "seasons" ALTER COLUMN "capacity" SET DEFAULT 35;

-- Extend seasons that are still accepting entries (or are closed but not yet
-- started) so the launch gate is consistently 35 paid entries.
UPDATE "seasons"
SET "capacity" = 35
WHERE "capacity" = 32
  AND "status" IN ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED');

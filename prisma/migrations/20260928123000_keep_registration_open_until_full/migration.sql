-- Season 0 is sold on a fill-the-field basis. Its original seed attached a
-- two-week deadline, which expired while the season was still open and empty.
-- That made the entry CTA say "Opening Soon" even though the season page said
-- "Taking entries". Remove the deadline only from seasons that are explicitly
-- still open; historical and closed seasons keep their recorded dates.
UPDATE "seasons"
SET "registrationEnd" = NULL
WHERE "status" = 'REGISTRATION_OPEN'
  AND "registrationEnd" IS NOT NULL;

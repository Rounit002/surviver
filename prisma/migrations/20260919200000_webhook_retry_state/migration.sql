-- Durable retry state for the provider webhook inbox.
--
-- Until now an event that failed processing (or landed in NEEDS_REVIEW) was
-- terminal: the next delivery of the same event id was treated as a duplicate
-- and dropped, so a transient fault permanently stranded a paid entry. These
-- columns let both a provider redelivery and the in-process sweep pick the
-- message back up, with a bounded number of attempts and a backoff between
-- them.
ALTER TABLE "webhook_events" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "webhook_events" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);

CREATE INDEX "webhook_events_status_nextAttemptAt_idx" ON "webhook_events"("status", "nextAttemptAt");

-- Rows written before this migration have no attempt history. Treat a settled
-- row as having had one attempt, and make anything still unresolved eligible
-- for the sweep immediately.
UPDATE "webhook_events" SET "attempts" = 1;
UPDATE "webhook_events" SET "nextAttemptAt" = NOW()
WHERE "status" IN ('RECEIVED', 'FAILED', 'NEEDS_REVIEW', 'PROCESSING');

-- The site's own presence counter: one row per anonymous visitor cookie.
CREATE TABLE "site_visitors" (
    "visitorId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_visitors_pkey" PRIMARY KEY ("visitorId")
);

-- "Online now" filters on lastSeenAt on every request, so it cannot be a scan.
CREATE INDEX "site_visitors_lastSeenAt_idx" ON "site_visitors"("lastSeenAt");

-- CreateTable
CREATE TABLE "lineup_clicks" (
    "id" TEXT NOT NULL,
    "seasonEntryId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lineup_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lineup_clicks_seasonEntryId_ipHash_createdAt_idx" ON "lineup_clicks"("seasonEntryId", "ipHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "lineup_clicks_seasonEntryId_visitorId_key" ON "lineup_clicks"("seasonEntryId", "visitorId");

-- AddForeignKey
ALTER TABLE "lineup_clicks" ADD CONSTRAINT "lineup_clicks_seasonEntryId_fkey" FOREIGN KEY ("seasonEntryId") REFERENCES "season_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;


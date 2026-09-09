-- AlterTable
ALTER TABLE "season_entries" ADD COLUMN     "manageToken" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "season_entries_manageToken_key" ON "season_entries"("manageToken");


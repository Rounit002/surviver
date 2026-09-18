-- Remove the administrator surface.
--
-- The site no longer has an admin panel. Entries are approved the moment their
-- payment settles, and seasons start and advance from the scheduled job, so
-- nothing reads a role and nothing writes an audit row.
--
-- Destructive: this drops the admin_actions audit trail permanently.

-- DropForeignKey
ALTER TABLE "admin_actions" DROP CONSTRAINT "admin_actions_adminUserId_fkey";

-- DropTable
DROP TABLE "admin_actions";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role";

-- DropEnum
DROP TYPE "Role";

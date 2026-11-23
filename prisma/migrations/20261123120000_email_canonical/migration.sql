-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailCanonical" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_emailCanonical_key" ON "User"("emailCanonical");

-- Case-insensitive uniqueness for email itself (not expressible in the Prisma
-- schema). Only created when existing data has no case-only duplicates, so a
-- legacy duplicate can never stop the app from starting; scripts/backfill.mjs
-- reports any that exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "User" GROUP BY lower("email") HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "User_email_lower_key" ON "User" (lower("email"));
  END IF;
END $$;

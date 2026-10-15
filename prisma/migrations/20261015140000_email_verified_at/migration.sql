-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);


-- Members who joined before email confirmation existed count as confirmed.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;

-- isVerified used to be set by clicking the sign-up email link, which showed the
-- blue "Verified" (selfie) check. It now means selfie-verified only: keep it for
-- approved selfie checks and admins, clear it for everyone else.
UPDATE "User" SET "isVerified" = false
 WHERE "isVerified" = true AND "verificationStatus" <> 'APPROVED' AND "role" <> 'ADMIN';

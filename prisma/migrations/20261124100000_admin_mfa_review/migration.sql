-- AlterTable
ALTER TABLE "User" ADD COLUMN     "knownDeviceHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mfaTicketExpires" TIMESTAMP(3),
ADD COLUMN     "mfaTicketHash" TEXT,
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpLastStep" INTEGER,
ADD COLUMN     "totpPendingSecret" TEXT,
ADD COLUMN     "totpRecoveryHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "totpSecret" TEXT,
ADD COLUMN     "underReviewAt" TIMESTAMP(3),
ADD COLUMN     "underReviewReason" TEXT;


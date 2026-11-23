-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "VerificationRequest" ADD COLUMN     "pose" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "readAt" TIMESTAMP(3);


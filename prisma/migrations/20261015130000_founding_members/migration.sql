-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "foundingMemberNumber" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Profile_foundingMemberNumber_key" ON "Profile"("foundingMemberNumber");


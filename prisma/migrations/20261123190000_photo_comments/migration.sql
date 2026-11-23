-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "commentCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PhotoComment" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoComment_photoId_createdAt_idx" ON "PhotoComment"("photoId", "createdAt");

-- CreateIndex
CREATE INDEX "PhotoComment_userId_createdAt_idx" ON "PhotoComment"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PhotoComment" ADD CONSTRAINT "PhotoComment_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoComment" ADD CONSTRAINT "PhotoComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


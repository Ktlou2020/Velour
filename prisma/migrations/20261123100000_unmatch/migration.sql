-- CreateTable
CREATE TABLE "Unmatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unmatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Unmatch_otherId_idx" ON "Unmatch"("otherId");

-- CreateIndex
CREATE UNIQUE INDEX "Unmatch_userId_otherId_key" ON "Unmatch"("userId", "otherId");


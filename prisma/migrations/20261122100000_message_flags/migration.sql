-- CreateTable
CREATE TABLE "MessageFlag" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "categories" TEXT[],
    "excerpt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "MessageFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageFlag_messageId_key" ON "MessageFlag"("messageId");

-- CreateIndex
CREATE INDEX "MessageFlag_reviewedAt_createdAt_idx" ON "MessageFlag"("reviewedAt", "createdAt");

-- CreateIndex
CREATE INDEX "MessageFlag_senderId_idx" ON "MessageFlag"("senderId");

-- AddForeignKey
ALTER TABLE "MessageFlag" ADD CONSTRAINT "MessageFlag_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "FunnelDaily" (
    "day" DATE NOT NULL,
    "step" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FunnelDaily_pkey" PRIMARY KEY ("day","step")
);

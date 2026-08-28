-- CreateTable
CREATE TABLE "ReferralContestRound" (
    "id" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "winnersJson" TEXT,
    "winnerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralContestRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralContestRound_roundNumber_key" ON "ReferralContestRound"("roundNumber");

-- CreateIndex
CREATE INDEX "ReferralContestRound_status_idx" ON "ReferralContestRound"("status");

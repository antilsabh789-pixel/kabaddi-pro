-- CreateTable
CREATE TABLE "ReferralContestParticipant" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralContestParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralContestParticipant_roundId_userId_key" ON "ReferralContestParticipant"("roundId", "userId");

-- CreateIndex
CREATE INDEX "ReferralContestParticipant_roundId_idx" ON "ReferralContestParticipant"("roundId");

-- AddForeignKey
ALTER TABLE "ReferralContestParticipant" ADD CONSTRAINT "ReferralContestParticipant_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ReferralContestRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralContestParticipant" ADD CONSTRAINT "ReferralContestParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

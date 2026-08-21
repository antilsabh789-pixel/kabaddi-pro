-- CreateTable
CREATE TABLE "CommunityTournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TEXT,
    "venue" TEXT,
    "prizeMoney" TEXT,
    "weightCategory" TEXT,
    "playerName" TEXT,
    "coachName" TEXT,
    "organizerPhone" TEXT,
    "organizerPhone2" TEXT,
    "postedBy" TEXT,
    "postedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityTournament_pkey" PRIMARY KEY ("id")
);

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'raiders';
    const gender = searchParams.get('gender') || 'all';
    const limit = parseInt(searchParams.get('limit') || '20');

    const userWhere: Record<string, unknown> = {};
    if (gender && gender !== 'all') {
      userWhere.gender = gender === 'male' ? 'male' : gender === 'female' ? 'female' : gender;
    }

    // Only consider players who have played at least 1 tournament match
    const profileWhere: Record<string, unknown> = {
      tournamentMatches: { gt: 0 },
    };

    let orderBy: Record<string, string>;
    let statField: string;
    let statLabel: string;

    switch (category) {
      case 'raiders':
        // Sorted by tournament raid points DESC
        orderBy = { tournamentRaidPoints: 'desc' };
        statField = 'raid';
        statLabel = 'Raid Points';
        break;
      case 'defenders':
        // Sorted by tournament tackle points DESC
        orderBy = { tournamentTacklePoints: 'desc' };
        statField = 'defense';
        statLabel = 'Tackle Points';
        break;
      case 'allrounders':
        // Sorted by tournament total points DESC
        orderBy = { tournamentTotalPoints: 'desc' };
        statField = 'allround';
        statLabel = 'Total Points';
        break;
      case 'mvp':
        // Sorted by overallRating DESC
        orderBy = { overallRating: 'desc' };
        statField = 'mvp';
        statLabel = 'Rating';
        break;
      default:
        orderBy = { tournamentRaidPoints: 'desc' };
        statField = 'raid';
        statLabel = 'Raid Points';
    }

    const profiles = await db.playerProfile.findMany({
      where: {
        user: userWhere,
        ...profileWhere,
      },
      orderBy,
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, avatar: true, gender: true, playerCode: true },
        },
      },
    });

    // Fetch team names for each player
    const results = await Promise.all(
      profiles.map(async (profile) => {
        const teamMemberships = await db.teamMember.findMany({
          where: { userId: profile.userId },
          include: { team: { select: { name: true } } },
        });
        const teamNames = teamMemberships.map((tm) => tm.team.name);

        let stat: number;
        switch (category) {
          case 'raiders':
            stat = profile.tournamentRaidPoints + profile.tournamentBonusPoints;
            break;
          case 'defenders':
            stat = profile.tournamentTacklePoints + profile.tournamentSuperTackles;
            break;
          case 'allrounders':
            stat = profile.tournamentTotalPoints;
            break;
          case 'mvp':
            stat = Math.round(profile.overallRating * 10) / 10;
            break;
          default:
            stat = profile.tournamentRaidPoints + profile.tournamentBonusPoints;
        }

        return {
          userId: profile.userId,
          name: profile.user.name || 'Unknown',
          avatar: profile.user.avatar,
          playerCode: profile.user.playerCode,
          teamNames,
          stat,
          statLabel,
          tournamentMatches: profile.tournamentMatches,
        };
      })
    );

    // Sort by the computed stat DESC
    results.sort((a, b) => b.stat - a.stat);

    // Add rank
    const leaderboard = results.map((r, i) => ({
      rank: i + 1,
      ...r,
    }));

    return NextResponse.json({ leaderboard, category });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

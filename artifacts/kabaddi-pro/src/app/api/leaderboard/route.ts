import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'raiders';
    const gender = searchParams.get('gender') || 'all';
    const limit = parseInt(searchParams.get('limit') || '20');
    const mode = searchParams.get('mode') || 'tournament'; // 'tournament' or 'practice'

    const isPractice = mode === 'practice';
    const prefix = isPractice ? 'practice' : 'tournament';

    const userWhere: Record<string, unknown> = {};
    if (gender && gender !== 'all') {
      userWhere.gender = gender === 'male' ? 'male' : gender === 'female' ? 'female' : gender;
    }

    // Only consider players who have played at least 1 match in the selected mode
    const profileWhere: Record<string, unknown> = {
      [`${prefix}Matches`]: { gt: 0 },
    };

    let orderBy: Record<string, string>;
    let statLabel: string;

    switch (category) {
      case 'raiders':
        orderBy = { [`${prefix}RaidPoints`]: 'desc' };
        statLabel = 'Raid Points';
        break;
      case 'defenders':
        orderBy = { [`${prefix}TacklePoints`]: 'desc' };
        statLabel = 'Tackle Points';
        break;
      case 'allrounders':
        orderBy = { [`${prefix}TotalPoints`]: 'desc' };
        statLabel = 'Total Points';
        break;
      case 'mvp':
      case 'rating':
        orderBy = { overallRating: 'desc' };
        statLabel = 'Rating';
        break;
      default:
        orderBy = { [`${prefix}RaidPoints`]: 'desc' };
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

        // Get stats from the correct prefix
        const profileAny = profile as unknown as Record<string, unknown>;
        const raidPts = (profileAny[`${prefix}RaidPoints`] as number) || 0;
        const tacklePts = (profileAny[`${prefix}TacklePoints`] as number) || 0;
        const totalPts = (profileAny[`${prefix}TotalPoints`] as number) || 0;
        const bonusPts = (profileAny[`${prefix}BonusPoints`] as number) || 0;
        const superTackles = (profileAny[`${prefix}SuperTackles`] as number) || 0;
        const matches = (profileAny[`${prefix}Matches`] as number) || 0;

        let stat: number;
        switch (category) {
          case 'raiders':
            stat = raidPts + bonusPts;
            statLabel = 'Raid Points';
            break;
          case 'defenders':
            stat = tacklePts + superTackles;
            statLabel = 'Tackle Points';
            break;
          case 'allrounders':
            stat = totalPts;
            statLabel = 'Total Points';
            break;
          case 'mvp':
          case 'rating':
            stat = Math.round(profile.overallRating * 10) / 10;
            statLabel = 'Rating';
            break;
          default:
            stat = raidPts + bonusPts;
            statLabel = 'Raid Points';
        }

        return {
          userId: profile.userId,
          name: profile.user.name || 'Unknown',
          avatar: profile.user.avatar,
          playerCode: profile.user.playerCode,
          teamNames,
          stat,
          statLabel,
          matches,
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

    return NextResponse.json({ leaderboard, category, mode });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

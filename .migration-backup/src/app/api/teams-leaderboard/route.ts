import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // Fetch all completed matches (non-practice) with team details
    const completedMatches = await db.match.findMany({
      where: {
        status: 'completed',
        isPractice: false,
      },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
        tournamentId: true,
      },
    });

    // Fetch all teams
    const teams = await db.team.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
        color: true,
        logo: true,
        teamCode: true,
        members: {
          select: { userId: true },
        },
      },
    });

    // Build a map of team stats
    const teamStatsMap = new Map<string, {
      id: string;
      name: string;
      shortName: string | null;
      color: string | null;
      logo: string | null;
      teamCode: string | null;
      memberCount: number;
      wins: number;
      losses: number;
      draws: number;
      played: number;
      pointsFor: number;
      pointsAgainst: number;
    }>();

    // Initialize all teams with 0 stats
    for (const team of teams) {
      teamStatsMap.set(team.id, {
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        color: team.color,
        logo: team.logo,
        teamCode: team.teamCode,
        memberCount: team.members.length,
        wins: 0,
        losses: 0,
        draws: 0,
        played: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      });
    }

    // Process each completed match
    for (const match of completedMatches) {
      const homeStats = teamStatsMap.get(match.homeTeamId);
      const awayStats = teamStatsMap.get(match.awayTeamId);

      if (!homeStats || !awayStats) continue;

      homeStats.played++;
      awayStats.played++;
      homeStats.pointsFor += match.homeScore;
      homeStats.pointsAgainst += match.awayScore;
      awayStats.pointsFor += match.awayScore;
      awayStats.pointsAgainst += match.homeScore;

      if (match.homeScore > match.awayScore) {
        // Home team wins
        homeStats.wins++;
        awayStats.losses++;
      } else if (match.awayScore > match.homeScore) {
        // Away team wins
        awayStats.wins++;
        homeStats.losses++;
      } else {
        // Draw
        homeStats.draws++;
        awayStats.draws++;
      }
    }

    // Calculate points: 2 per win, -1 per loss, 0 per draw
    const leaderboard = Array.from(teamStatsMap.values())
      .filter(team => team.played > 0) // Only show teams that have played at least 1 match
      .map(team => ({
        ...team,
        points: (team.wins * 2) + (team.losses * -1) + (team.draws * 0),
        scoreDiff: team.pointsFor - team.pointsAgainst,
      }))
      .sort((a, b) => {
        // Sort by points DESC, then by score diff DESC, then by wins DESC
        if (b.points !== a.points) return b.points - a.points;
        if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
        return b.wins - a.wins;
      })
      .map((team, index) => ({
        rank: index + 1,
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        color: team.color,
        logo: team.logo,
        teamCode: team.teamCode,
        memberCount: team.memberCount,
        played: team.played,
        wins: team.wins,
        losses: team.losses,
        draws: team.draws,
        points: team.points,
        pointsFor: team.pointsFor,
        pointsAgainst: team.pointsAgainst,
        scoreDiff: team.scoreDiff,
      }))
      .slice(0, limit);

    // Also include teams that haven't played yet (with 0 stats) - at the bottom
    const unrankedTeams = Array.from(teamStatsMap.values())
      .filter(team => team.played === 0)
      .map(team => ({
        rank: 0,
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        color: team.color,
        logo: team.logo,
        teamCode: team.teamCode,
        memberCount: team.memberCount,
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        scoreDiff: 0,
      }));

    return NextResponse.json({
      leaderboard,
      unrankedTeams,
      totalTeams: teams.length,
      totalMatchesPlayed: completedMatches.length,
    });
  } catch (error) {
    console.error('Teams leaderboard fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

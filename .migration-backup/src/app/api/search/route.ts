import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    const type = searchParams.get('type')?.trim() || 'all';

    if (!q || q.length < 1) {
      return NextResponse.json({ players: [], teams: [], tournaments: [], matches: [] });
    }

    const filterType = ['all', 'players', 'teams', 'tournaments', 'matches'].includes(type) ? type : 'all';
    const results: {
      players: Array<{
        id: string;
        name: string | null;
        playerCode: string | null;
        avatar: string | null;
        position: string | null;
        teamNames: string[];
        raidPoints: number;
        tacklePoints: number;
      }>;
      teams: Array<{
        id: string;
        name: string;
        shortName: string | null;
        color: string | null;
        teamCode: string | null;
        memberCount: number;
      }>;
      tournaments: Array<{
        id: string;
        name: string;
        type: string;
        status: string;
        tournamentCode: string | null;
      }>;
      matches: Array<{
        id: string;
        homeTeamName: string;
        awayTeamName: string;
        homeTeamColor: string | null;
        awayTeamColor: string | null;
        homeTeamShort: string | null;
        awayTeamShort: string | null;
        homeScore: number;
        awayScore: number;
        status: string;
        date: string | null;
      }>;
    } = { players: [], teams: [], tournaments: [], matches: [] };

    // Search players (users)
    if (filterType === 'all' || filterType === 'players') {
      const players = await db.user.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { playerCode: { contains: q } },
          ],
        },
        select: {
          id: true,
          name: true,
          playerCode: true,
          avatar: true,
          profile: { select: { position: true, raidPoints: true, tacklePoints: true } },
          teams: {
            select: { team: { select: { name: true } } },
            take: 3,
          },
        },
        take: 20,
      });

      results.players = players.map((p) => ({
        id: p.id,
        name: p.name,
        playerCode: p.playerCode,
        avatar: p.avatar,
        position: p.profile?.position ?? null,
        teamNames: p.teams.map((tm) => tm.team.name),
        raidPoints: p.profile?.raidPoints ?? 0,
        tacklePoints: p.profile?.tacklePoints ?? 0,
      }));
    }

    // Search teams
    if (filterType === 'all' || filterType === 'teams') {
      const teams = await db.team.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { shortName: { contains: q } },
            { teamCode: { contains: q } },
          ],
        },
        select: {
          id: true,
          name: true,
          shortName: true,
          color: true,
          teamCode: true,
          _count: { select: { members: true } },
        },
        take: 20,
      });

      results.teams = teams.map((t) => ({
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        color: t.color,
        teamCode: t.teamCode,
        memberCount: t._count.members,
      }));
    }

    // Search tournaments
    if (filterType === 'all' || filterType === 'tournaments') {
      const tournaments = await db.tournament.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { tournamentCode: { contains: q } },
          ],
        },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          tournamentCode: true,
        },
        take: 20,
      });

      results.tournaments = tournaments;
    }

    // Search matches
    if (filterType === 'all' || filterType === 'matches') {
      const matches = await db.match.findMany({
        where: {
          OR: [
            { homeTeam: { name: { contains: q } } },
            { awayTeam: { name: { contains: q } } },
            { homeTeam: { shortName: { contains: q } } },
            { awayTeam: { shortName: { contains: q } } },
          ],
        },
        select: {
          id: true,
          homeScore: true,
          awayScore: true,
          status: true,
          startedAt: true,
          createdAt: true,
          homeTeam: { select: { name: true, shortName: true, color: true } },
          awayTeam: { select: { name: true, shortName: true, color: true } },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });

      results.matches = matches.map((m) => ({
        id: m.id,
        homeTeamName: m.homeTeam.name,
        awayTeamName: m.awayTeam.name,
        homeTeamColor: m.homeTeam.color,
        awayTeamColor: m.awayTeam.color,
        homeTeamShort: m.homeTeam.shortName,
        awayTeamShort: m.awayTeam.shortName,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        date: m.startedAt
          ? new Date(m.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }));
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

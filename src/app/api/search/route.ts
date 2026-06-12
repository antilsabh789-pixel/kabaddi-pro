import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    const type = searchParams.get('type')?.trim() || 'all';

    if (!q || q.length < 1) {
      return NextResponse.json({ players: [], teams: [], tournaments: [] });
    }

    const filterType = ['all', 'players', 'teams', 'tournaments'].includes(type) ? type : 'all';
    const results: {
      players: Array<{
        id: string;
        name: string | null;
        playerCode: string | null;
        avatar: string | null;
        position: string | null;
        teamNames: string[];
      }>;
      teams: Array<{
        id: string;
        name: string;
        shortName: string | null;
        color: string | null;
        teamCode: string | null;
      }>;
      tournaments: Array<{
        id: string;
        name: string;
        type: string;
        status: string;
        tournamentCode: string | null;
      }>;
    } = { players: [], teams: [], tournaments: [] };

    // Search players (users)
    if (filterType === 'all' || filterType === 'players') {
      const players = await db.user.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { playerCode: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          playerCode: true,
          avatar: true,
          profile: { select: { position: true } },
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
      }));
    }

    // Search teams
    if (filterType === 'all' || filterType === 'teams') {
      const teams = await db.team.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { shortName: { contains: q, mode: 'insensitive' } },
            { teamCode: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          shortName: true,
          color: true,
          teamCode: true,
        },
        take: 20,
      });

      results.teams = teams;
    }

    // Search tournaments
    if (filterType === 'all' || filterType === 'tournaments') {
      const tournaments = await db.tournament.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { tournamentCode: { contains: q, mode: 'insensitive' } },
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

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Generate a unique tournament code in format TC3001, TC3002, etc.
 */
async function generateTournamentCode(): Promise<string> {
  const lastTournament = await db.tournament.findFirst({
    where: { tournamentCode: { not: null } },
    orderBy: { tournamentCode: 'desc' },
    select: { tournamentCode: true },
  });

  let nextNum = 3001; // Start from TC3001
  if (lastTournament?.tournamentCode) {
    const match = lastTournament.tournamentCode.match(/TC(\d+)/);
    if (match) {
      nextNum = parseInt(match[1]) + 1;
    }
  }

  return `TC${nextNum}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const gender = searchParams.get('gender') || '';
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (gender && gender !== 'all') where.gender = gender;

    // Support search by tournament code or name
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { tournamentCode: { contains: search } },
      ];
      // Remove status/gender from top-level if using OR (they need to be inside AND)
      if (status || (gender && gender !== 'all')) {
        const filters: Record<string, unknown>[] = [];
        if (status) filters.push({ status });
        if (gender && gender !== 'all') filters.push({ gender });
        delete where.status;
        delete where.gender;
        where.AND = [...filters, { OR: where.OR }];
        delete where.OR;
      }
    }

    const tournaments = await db.tournament.findMany({
      where,
      include: {
        entries: { include: { team: true } },
        matches: { include: { homeTeam: true, awayTeam: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      tournamentCode: t.tournamentCode,
      type: t.type,
      venue: t.venue,
      startDate: t.startDate ? t.startDate.toISOString().split('T')[0] : null,
      endDate: t.endDate ? t.endDate.toISOString().split('T')[0] : null,
      status: t.status,
      gender: t.gender,
      organizerId: t.organizerId,
      teams: t.entries.map((entry) => ({
        id: entry.team.id,
        name: entry.team.name,
        shortName: entry.team.shortName,
        teamCode: entry.team.teamCode,
        color: entry.team.color,
        logo: entry.team.logo,
        played: entry.played,
        won: entry.won,
        lost: entry.lost,
        drawn: entry.drawn,
        scoreDiff: entry.scoreDiff,
        points: entry.points,
      })),
      matchCount: t.matches.length,
    }));

    return NextResponse.json({ tournaments: formatted });
  } catch (error) {
    console.error('Tournaments fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, venue, gender, type, startDate, endDate, organizerId } = body;

    // Auto-generate tournament code
    const tournamentCode = await generateTournamentCode();

    const tournament = await db.tournament.create({
      data: {
        name,
        tournamentCode,
        venue,
        gender,
        type: type || 'knockout',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        organizerId,
        status: 'upcoming',
      },
    });

    return NextResponse.json({ tournament }, { status: 201 });
  } catch (error) {
    console.error('Tournament create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            team: {
              include: { members: { include: { user: { include: { profile: true } } } } },
            },
          },
        },
        matches: { include: { homeTeam: true, awayTeam: true, events: true, scorers: { include: { user: true } } } },
        organizer: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    return NextResponse.json({ tournament });
  } catch (error) {
    console.error('Tournament fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { addTeamIds, removeTeamIds, ...updateData } = body;

    // If just updating tournament info (name, status, etc.)
    if (!addTeamIds && !removeTeamIds) {
      const tournament = await db.tournament.update({
        where: { id },
        data: updateData,
      });
      return NextResponse.json({ tournament });
    }

    // Handle adding/removing teams mid-tournament
    const tournament = await db.tournament.findUnique({
      where: { id },
      include: { entries: true },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const existingTeamIds = new Set(tournament.entries.map(e => e.teamId));

    // Add teams
    if (addTeamIds && Array.isArray(addTeamIds) && addTeamIds.length > 0) {
      // Validate teams exist
      const teams = await db.team.findMany({
        where: { id: { in: addTeamIds } },
      });

      if (teams.length !== addTeamIds.length) {
        const foundIds = new Set(teams.map(t => t.id));
        const missing = addTeamIds.filter(tid => !foundIds.has(tid));
        return NextResponse.json(
          { error: `Teams not found: ${missing.join(', ')}` },
          { status: 400 }
        );
      }

      // Filter out already-entered teams
      const newTeamIds = addTeamIds.filter(tid => !existingTeamIds.has(tid));

      if (newTeamIds.length > 0) {
        for (const teamId of newTeamIds) {
          await db.tournamentEntry.create({
            data: {
              tournamentId: id,
              teamId,
            },
          });
        }

        // If tournament is ongoing (league/hybrid), generate additional matches for new teams
        if (tournament.status === 'ongoing' && (tournament.type === 'league' || tournament.type === 'hybrid')) {
          const allTeamIds = [...existingTeamIds, ...newTeamIds];
          const newTeamIdsArr = newTeamIds;

          // Generate matches between new teams and ALL existing teams
          const matchesToCreate: Array<{
            tournamentId: string;
            homeTeamId: string;
            awayTeamId: string;
            homeScore: number;
            awayScore: number;
            half: number;
            halfDuration: number;
            playersPerSide: number;
            status: string;
            isPractice: boolean;
            gender: string | null;
            venue: string | null;
          }> = [];

          for (const newTeamId of newTeamIdsArr) {
            for (const existingTeamId of allTeamIds) {
              if (newTeamId === existingTeamId) continue;
              const homeIdx = allTeamIds.indexOf(newTeamId);
              const awayIdx = allTeamIds.indexOf(existingTeamId);
              const isHome = (homeIdx + awayIdx) % 2 === 0;
              matchesToCreate.push({
                tournamentId: id,
                homeTeamId: isHome ? newTeamId : existingTeamId,
                awayTeamId: isHome ? existingTeamId : newTeamId,
                homeScore: 0,
                awayScore: 0,
                half: 1,
                halfDuration: 20,
                playersPerSide: 7,
                status: 'upcoming',
                isPractice: false,
                gender: tournament.gender,
                venue: tournament.venue,
              });
            }
          }

          // Deduplicate (avoid creating the same matchup twice)
          const seenMatchups = new Set<string>();
          const uniqueMatches = matchesToCreate.filter(m => {
            const key = [m.homeTeamId, m.awayTeamId].sort().join('-');
            if (seenMatchups.has(key)) return false;
            seenMatchups.add(key);
            return true;
          });

          for (const matchData of uniqueMatches) {
            await db.match.create({ data: matchData });
          }
        }

        // If tournament is upcoming, just add entries (bracket will be generated later)
      }
    }

    // Remove teams
    if (removeTeamIds && Array.isArray(removeTeamIds) && removeTeamIds.length > 0) {
      await db.tournamentEntry.deleteMany({
        where: {
          tournamentId: id,
          teamId: { in: removeTeamIds },
        },
      });

      // Also remove any upcoming matches involving these teams
      await db.match.deleteMany({
        where: {
          tournamentId: id,
          status: 'upcoming',
          OR: [
            { homeTeamId: { in: removeTeamIds } },
            { awayTeamId: { in: removeTeamIds } },
          ],
        },
      });
    }

    // Update other tournament data if provided
    if (Object.keys(updateData).length > 0) {
      await db.tournament.update({
        where: { id },
        data: updateData,
      });
    }

    const updatedTournament = await db.tournament.findUnique({
      where: { id },
      include: { entries: { include: { team: true } }, matches: true },
    });

    return NextResponse.json({
      tournament: updatedTournament,
      message: addTeamIds
        ? `${addTeamIds.filter(tid => !existingTeamIds.has(tid)).length} team(s) added`
        : undefined,
    });
  } catch (error) {
    console.error('Tournament update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

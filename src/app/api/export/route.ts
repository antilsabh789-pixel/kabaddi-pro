import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function escapeCsvField(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(',');
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const headerRow = toCsvRow(headers);
  const dataRows = rows.map((row) => toCsvRow(row));
  return [headerRow, ...dataRows].join('\n');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'players';
    const id = searchParams.get('id') || '';
    const format = searchParams.get('format') || 'csv';

    if (format !== 'csv') {
      return NextResponse.json(
        { error: 'Only CSV format is supported' },
        { status: 400 }
      );
    }

    let csvContent: string;
    let filename: string;

    switch (type) {
      case 'players': {
        const players = await db.user.findMany({
          where: { role: 'player' },
          include: { profile: true },
          orderBy: { createdAt: 'desc' },
        });

        const headers = [
          'ID', 'Name', 'Phone', 'Email', 'Role', 'Gender', 'Weight',
          'Jersey Number', 'Position', 'Overall Rating',
          'Total Raids', 'Successful Raids', 'Total Tackles', 'Successful Tackles',
          'Bonus Points', 'Super Tackles',
        ];

        const rows = players.map((p) => [
          p.id,
          p.name || '',
          p.phone,
          p.email || '',
          p.role,
          p.gender || '',
          p.weight || '',
          p.profile?.jerseyNumber ?? '',
          p.profile?.position || '',
          p.profile?.overallRating ?? 0,
          p.profile?.totalRaids ?? 0,
          p.profile?.successfulRaids ?? 0,
          p.profile?.totalTackles ?? 0,
          p.profile?.successfulTackles ?? 0,
          p.profile?.bonusPoints ?? 0,
          p.profile?.superTackles ?? 0,
        ]);

        csvContent = toCsv(headers, rows);
        filename = 'players_export.csv';
        break;
      }

      case 'matches': {
        const matches = await db.match.findMany({
          include: {
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
            tournament: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        const headers = [
          'ID', 'Home Team', 'Away Team', 'Home Score', 'Away Score',
          'Half', 'Status', 'Is Practice', 'Gender', 'Venue',
          'Tournament', 'Started At', 'Completed At',
        ];

        const rows = matches.map((m) => [
          m.id,
          m.homeTeam.name,
          m.awayTeam.name,
          m.homeScore,
          m.awayScore,
          m.half,
          m.status,
          m.isPractice ? 'Yes' : 'No',
          m.gender || '',
          m.venue || '',
          m.tournament?.name || '',
          m.startedAt?.toISOString() || '',
          m.completedAt?.toISOString() || '',
        ]);

        csvContent = toCsv(headers, rows);
        filename = 'matches_export.csv';
        break;
      }

      case 'tournament': {
        if (!id) {
          return NextResponse.json(
            { error: 'id is required for tournament export' },
            { status: 400 }
          );
        }

        const tournament = await db.tournament.findUnique({
          where: { id },
          include: {
            entries: {
              include: {
                team: { select: { name: true, shortName: true } },
              },
              orderBy: { points: 'desc' },
            },
            matches: {
              include: {
                homeTeam: { select: { name: true } },
                awayTeam: { select: { name: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        });

        if (!tournament) {
          return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        const headers = [
          'Team Name', 'Short Name', 'Played', 'Won', 'Lost', 'Drawn',
          'Score Diff', 'Points',
        ];

        const rows = tournament.entries.map((e) => [
          e.team.name,
          e.team.shortName || '',
          e.played,
          e.won,
          e.lost,
          e.drawn,
          e.scoreDiff,
          e.points,
        ]);

        csvContent = toCsv(headers, rows);
        filename = `tournament_${tournament.name.replace(/\s+/g, '_')}_export.csv`;
        break;
      }

      case 'season': {
        if (!id) {
          return NextResponse.json(
            { error: 'id is required for season export' },
            { status: 400 }
          );
        }

        const season = await db.season.findUnique({
          where: { id },
          include: {
            seasonTeams: {
              include: {
                team: { select: { name: true, shortName: true } },
              },
              orderBy: { points: 'desc' },
            },
          },
        });

        if (!season) {
          return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }

        const headers = [
          'Rank', 'Team Name', 'Short Name', 'Wins', 'Losses', 'Draws', 'Points',
        ];

        const rows = season.seasonTeams.map((st, index) => [
          st.rank ?? index + 1,
          st.team.name,
          st.team.shortName || '',
          st.wins,
          st.losses,
          st.draws,
          st.points,
        ]);

        csvContent = toCsv(headers, rows);
        filename = `season_${season.name.replace(/\s+/g, '_')}_export.csv`;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Invalid export type: ${type}. Must be players, matches, tournament, or season` },
          { status: 400 }
        );
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

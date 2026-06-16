import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/match-report
 * Generates an AI match report for a given match.
 * Body: { matchId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
    }

    // Fetch match details with teams
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: { select: { id: true, name: true, color: true } },
        awayTeam: { select: { id: true, name: true, color: true } },
        tournament: { select: { id: true, name: true } },
        events: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Build match summary for the AI prompt
    const homeTeamName = match.homeTeam.name;
    const awayTeamName = match.awayTeam.name;
    const homeScore = match.homeScore;
    const awayScore = match.awayScore;
    const status = match.status;
    const halfDuration = match.halfDuration;
    const gender = match.gender || 'Not specified';
    const weightCategory = match.weightCategory || 'Open';
    const tournamentName = match.tournament?.name || 'Friendly';
    const isPractice = match.isPractice;
    const venue = match.venue || 'Not specified';

    // Count events by type per team
    const homeEvents = match.events.filter((e) => e.teamId === match.homeTeamId);
    const awayEvents = match.events.filter((e) => e.teamId === match.awayTeamId);

    const countEvents = (events: typeof match.events) => {
      const counts: Record<string, number> = {};
      for (const e of events) {
        counts[e.eventType] = (counts[e.eventType] || 0) + 1;
      }
      return counts;
    };

    const homeEventCounts = countEvents(homeEvents);
    const awayEventCounts = countEvents(awayEvents);

    // Find top performers
    const playerPoints: Record<string, { name: string; points: number; teamId: string }> = {};
    for (const evt of match.events) {
      if (evt.playerId && evt.value > 0) {
        if (!playerPoints[evt.playerId]) {
          playerPoints[evt.playerId] = {
            name: evt.playerId, // We'll try to get names from details
            points: 0,
            teamId: evt.teamId,
          };
        }
        playerPoints[evt.playerId].points += evt.value;
      }
    }

    // Extract player names from event details
    for (const evt of match.events) {
      if (evt.playerId && evt.details) {
        try {
          const d = JSON.parse(evt.details);
          if (d.playerName && playerPoints[evt.playerId]) {
            playerPoints[evt.playerId].name = d.playerName;
          }
        } catch { /* ignore */ }
      }
    }

    const topPerformers = Object.values(playerPoints)
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    // Determine winner
    let winner = '';
    if (status === 'completed') {
      if (homeScore > awayScore) winner = `${homeTeamName} won by ${homeScore - awayScore} points`;
      else if (awayScore > homeScore) winner = `${awayTeamName} won by ${awayScore - homeScore} points`;
      else winner = 'The match ended in a draw';
    } else {
      winner = 'Match is still in progress';
    }

    // Build the prompt for the LLM
    const prompt = `You are a professional Kabaddi sports journalist. Write an engaging match report article for the following Kabaddi match.

MATCH DETAILS:
- Tournament: ${tournamentName}${isPractice ? ' (Practice Match)' : ''}
- Home Team: ${homeTeamName} vs Away Team: ${awayTeamName}
- Final Score: ${homeTeamName} ${homeScore} - ${awayScore} ${awayTeamName}
- Result: ${winner}
- Half Duration: ${halfDuration} minutes per half
- Gender: ${gender}
- Weight Category: ${weightCategory}
- Venue: ${venue}

MATCH STATISTICS:
${homeTeamName}:
- Raid Points: ${homeEventCounts.raid_point || 0}
- Bonus Points: ${homeEventCounts.bonus_point || 0}
- Tackle Points: ${homeEventCounts.tackle_point || 0}
- Super Tackles: ${homeEventCounts.super_tackle || 0}
- Super Raids: ${homeEventCounts.super_raid || 0}
- All Outs: ${homeEventCounts.all_out || 0}
- Empty Raids: ${homeEventCounts.empty_raid || 0}

${awayTeamName}:
- Raid Points: ${awayEventCounts.raid_point || 0}
- Bonus Points: ${awayEventCounts.bonus_point || 0}
- Tackle Points: ${awayEventCounts.tackle_point || 0}
- Super Tackles: ${awayEventCounts.super_tackle || 0}
- Super Raids: ${awayEventCounts.super_raid || 0}
- All Outs: ${awayEventCounts.all_out || 0}
- Empty Raids: ${awayEventCounts.empty_raid || 0}

TOP PERFORMERS:
${topPerformers.map((p, i) => `${i + 1}. ${p.name} (${p.teamId === match.homeTeamId ? homeTeamName : awayTeamName}) - ${p.points} points`).join('\n')}

Please write a compelling match report with:
1. An attention-grabbing headline
2. A summary paragraph
3. Key moments and turning points
4. Analysis of both teams' performance
5. A concluding thought

Write in an exciting, professional sports journalism style. Keep it under 500 words. Use markdown formatting with headers (##) for sections.`;

    // Use z-ai-web-dev-sdk to generate the report
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      thinking: { type: 'disabled' },
    });

    const reportText = response.choices?.[0]?.message?.content || 'Unable to generate report. Please try again.';

    return NextResponse.json({
      report: reportText,
      matchInfo: {
        id: match.id,
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        homeScore,
        awayScore,
        homeTeamColor: match.homeTeam.color,
        awayTeamColor: match.awayTeam.color,
        status,
        tournamentName,
        completedAt: match.completedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Match report generation error:', error);
    return NextResponse.json({ error: 'Failed to generate match report' }, { status: 500 });
  }
}

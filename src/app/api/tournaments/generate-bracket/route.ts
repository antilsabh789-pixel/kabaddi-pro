import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TournamentInfo {
  id: string;
  gender?: string | null;
  venue?: string | null;
}

/** Default half-duration in minutes for tournament matches. */
const DEFAULT_HALF_DURATION = 20;
/** Default players per side. */
const DEFAULT_PLAYERS_PER_SIDE = 7;

/**
 * Generate the standard seeded bracket order for a power-of-2 sized bracket.
 *
 * For a bracket of size `n` the returned array contains seed numbers (1-indexed)
 * arranged so that:
 *   - Seed 1 and Seed 2 can only meet in the final
 *   - Seed 1 and Seed 4 can only meet in the semi-final (for 8+), etc.
 *
 * Examples:
 *   n=2  → [1, 2]
 *   n=4  → [1, 4, 2, 3]                       (match-ups: 1v4, 2v3)
 *   n=8  → [1, 8, 4, 5, 2, 7, 3, 6]           (match-ups: 1v8, 4v5, 2v7, 3v6)
 *   n=16 → [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11]
 */
function getSeededOrder(size: number): number[] {
  if (size <= 1) return [1];
  if (size === 2) return [1, 2];

  const half = size / 2;
  const topHalf = getSeededOrder(half);
  const bottomHalf = topHalf.map((seed) => size + 1 - seed);

  const result: number[] = [];
  for (let i = 0; i < half; i++) {
    result.push(topHalf[i]);
    result.push(bottomHalf[i]);
  }
  return result;
}

/**
 * Build a common match data object from tournament info.
 */
function buildMatchData(
  tournamentId: string,
  homeTeamId: string,
  awayTeamId: string,
  tournament: TournamentInfo,
) {
  return {
    tournamentId,
    homeTeamId,
    awayTeamId,
    homeScore: 0,
    awayScore: 0,
    half: 1,
    halfDuration: DEFAULT_HALF_DURATION,
    playersPerSide: DEFAULT_PLAYERS_PER_SIDE,
    status: 'upcoming' as const,
    isPractice: false,
    gender: tournament.gender ?? null,
    venue: tournament.venue ?? null,
  };
}

// ---------------------------------------------------------------------------
// Knockout bracket generation
// ---------------------------------------------------------------------------

/**
 * Generate elimination bracket matches.
 *
 * - For power-of-2 team counts the bracket is straightforward.
 * - For non-power-of-2 the bracket size is rounded up to the next power of 2
 *   and the excess slots become **byes** for the highest-seeded teams.
 *
 * All rounds are generated upfront.  For rounds beyond the first, the
 * higher-seeded potential team is used as a placeholder (the actual team will
 * be overwritten when the preceding round result is recorded).
 *
 * Bracket sizes:
 *   2 teams  → 1 final
 *   4 teams  → 2 semi-finals + 1 final
 *   8 teams  → 4 quarter-finals + 2 semi-finals + 1 final
 *   16 teams → 8 round-of-16 + 4 quarter-finals + 2 semi-finals + 1 final
 *   Non-power-of-2 → byes for top-seeded teams in round 1
 */
function generateKnockoutMatches(
  teamIds: string[],
  tournament: TournamentInfo,
) {
  const n = teamIds.length;
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const seededOrder = getSeededOrder(bracketSize);
  const totalRounds = Math.round(Math.log2(bracketSize));

  // Map a seed number (1-indexed) to a real team ID, or null for byes.
  const seedToTeamId = (seed: number): string | null =>
    seed <= n ? teamIds[seed - 1] : null;

  const matches: ReturnType<typeof buildMatchData>[] = [];

  // currentSlots holds the team (or placeholder) that occupies each position
  // in the current round.  `null` represents a bye / TBD.
  let currentSlots: (string | null)[] = seededOrder.map(seedToTeamId);

  for (let round = 1; round <= totalRounds; round++) {
    const nextSlots: (string | null)[] = [];

    for (let i = 0; i < currentSlots.length; i += 2) {
      const home = currentSlots[i];
      const away = currentSlots[i + 1];

      if (home === null && away === null) {
        // Both slots are undetermined – shouldn't happen in the first round
        // but can occur in later rounds when all feeding matches are TBD.
        nextSlots.push(null);
      } else if (home === null || away === null) {
        // One side is a bye / TBD – the other side advances automatically.
        nextSlots.push(home ?? away);
      } else {
        // Both sides are determined – create a match.
        matches.push(buildMatchData(tournament.id, home, away, tournament));
        // Placeholder: the higher-seeded team (home) advances.
        nextSlots.push(home);
      }
    }

    currentSlots = nextSlots;
  }

  return matches;
}

// ---------------------------------------------------------------------------
// League (round-robin) match generation
// ---------------------------------------------------------------------------

/**
 * Generate round-robin matches where every team plays every other team once.
 *
 * For N teams this produces N×(N−1)/2 matches.  Home/away is alternated so
 * that no team has a disproportionately home-heavy or away-heavy schedule.
 */
function generateLeagueMatches(
  teamIds: string[],
  tournament: TournamentInfo,
) {
  const n = teamIds.length;
  const matches: ReturnType<typeof buildMatchData>[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Alternate home/away based on the pair index to keep it balanced.
      const homeIdx = (i + j) % 2 === 0 ? i : j;
      const awayIdx = (i + j) % 2 === 0 ? j : i;

      matches.push(
        buildMatchData(
          tournament.id,
          teamIds[homeIdx],
          teamIds[awayIdx],
          tournament,
        ),
      );
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Hybrid match generation
// ---------------------------------------------------------------------------

/**
 * For hybrid tournaments the league stage is played first (round-robin).
 * The knockout stage for the top qualifying teams is generated separately
 * once the league results are known.
 *
 * This function therefore generates only the league-stage matches and
 * returns metadata indicating how many teams will qualify for the knockout
 * phase so the caller can generate those matches later.
 */
function generateHybridMatches(
  teamIds: string[],
  tournament: TournamentInfo,
) {
  const leagueMatches = generateLeagueMatches(teamIds, tournament);

  // Determine a sensible number of knockout qualifiers.
  // Default: top 4 teams qualify for semi-finals; if fewer than 4 teams
  // then top 2 qualify for a final.
  const knockoutQualifiers = teamIds.length >= 4 ? 4 : 2;

  return { leagueMatches, knockoutQualifiers };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tournamentId, teamIds } = body as {
      tournamentId?: string;
      teamIds?: string[];
    };

    // ---- Validation ----

    if (!tournamentId || !Array.isArray(teamIds) || teamIds.length < 2) {
      return NextResponse.json(
        {
          error:
            'tournamentId and teamIds (array with at least 2 teams) are required',
        },
        { status: 400 },
      );
    }

    // Reject duplicate team IDs.
    const uniqueTeamIds = [...new Set(teamIds)];
    if (uniqueTeamIds.length !== teamIds.length) {
      return NextResponse.json(
        { error: 'Duplicate team IDs are not allowed' },
        { status: 400 },
      );
    }

    // Fetch the tournament.
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 },
      );
    }

    if (tournament.status !== 'upcoming') {
      return NextResponse.json(
        {
          error:
            'Bracket can only be generated for tournaments with "upcoming" status',
        },
        { status: 400 },
      );
    }

    // Verify every team exists.
    const teams = await db.team.findMany({
      where: { id: { in: teamIds } },
    });
    if (teams.length !== teamIds.length) {
      const foundIds = new Set(teams.map((t) => t.id));
      const missing = teamIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        { error: `Teams not found: ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    // Verify no team is already entered in this tournament.
    const existingEntries = await db.tournamentEntry.findMany({
      where: { tournamentId, teamId: { in: teamIds } },
    });
    if (existingEntries.length > 0) {
      const duplicateIds = existingEntries
        .map((e) => e.teamId)
        .join(', ');
      return NextResponse.json(
        {
          error: `Teams already entered in this tournament: ${duplicateIds}`,
        },
        { status: 400 },
      );
    }

    // ---- Generate match data based on tournament type ----

    const tournamentInfo: TournamentInfo = {
      id: tournament.id,
      gender: tournament.gender,
      venue: tournament.venue,
    };

    let matchDataList: ReturnType<typeof buildMatchData>[];
    let knockoutQualifiers: number | null = null;

    switch (tournament.type) {
      case 'knockout':
        matchDataList = generateKnockoutMatches(teamIds, tournamentInfo);
        break;

      case 'league':
        matchDataList = generateLeagueMatches(teamIds, tournamentInfo);
        break;

      case 'hybrid': {
        const hybrid = generateHybridMatches(teamIds, tournamentInfo);
        matchDataList = hybrid.leagueMatches;
        knockoutQualifiers = hybrid.knockoutQualifiers;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown tournament type: "${tournament.type}"` },
          { status: 400 },
        );
    }

    // ---- Persist everything in a single transaction ----

    const result = await db.$transaction(async (tx) => {
      // 1. Create TournamentEntry records for every team.
      for (const teamId of teamIds) {
        await tx.tournamentEntry.create({
          data: {
            tournamentId,
            teamId,
          },
        });
      }

      // 2. Create Match records.
      const createdMatches: Array<{ id: string }> = [];
      for (const matchData of matchDataList) {
        const match = await tx.match.create({ data: matchData });
        createdMatches.push(match);
      }

      // 3. Update tournament status to "ongoing".
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: 'ongoing' },
      });

      return createdMatches;
    });

    // ---- Build response ----

    const response: Record<string, unknown> = {
      matches: result,
      matchCount: result.length,
    };

    if (tournament.type === 'hybrid' && knockoutQualifiers !== null) {
      response.message =
        'League stage matches generated. Knockout stage matches for the top ' +
        `${knockoutQualifiers} teams should be generated after the league ` +
        'stage is completed.';
      response.knockoutQualifiers = knockoutQualifiers;
    }

    if (tournament.type === 'knockout') {
      const bracketSize = Math.pow(
        2,
        Math.ceil(Math.log2(teamIds.length)),
      );
      const byes = bracketSize - teamIds.length;
      if (byes > 0) {
        response.message =
          `Knockout bracket generated with ${byes} bye(s). ` +
          'Top-seeded teams receive byes in round 1. ' +
          'Later-round matches use placeholder teams and will be ' +
          'updated as earlier rounds are completed.';
      }
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error generating tournament bracket:', error);
    return NextResponse.json(
      { error: 'Failed to generate tournament bracket' },
      { status: 500 },
    );
  }
}

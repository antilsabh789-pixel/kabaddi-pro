import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const EARTH_RADIUS_KM = 6371;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * GET /api/team-suggestions?userId=xxx
 * Suggests teams for a user based on position needs, location proximity, and skill matching
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    // Get user's profile and location
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        playerLocation: true,
        teams: { select: { teamId: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userPosition = user.profile?.position?.toLowerCase() || null;
    const userRating = user.profile?.overallRating || 0;
    const userLocation = user.playerLocation;
    const existingTeamIds = new Set(user.teams.map((t) => t.teamId));

    // Get all teams the user is NOT in, with their members
    const allTeams = await db.team.findMany({
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                playerLocation: { select: { lat: true, lng: true } },
                profile: { select: { position: true, overallRating: true } },
              },
            },
          },
        },
        _count: { select: { members: true } },
      },
    });

    const suggestions = [];

    for (const team of allTeams) {
      // Skip teams user is already in
      if (existingTeamIds.has(team.id)) continue;

      const reasons: string[] = [];
      let score = 0;

      // Count positions in the team
      const positionCounts: Record<string, number> = { raider: 0, defender: 0, 'all-rounder': 0 };
      let teamAvgRating = 0;
      let ratingCount = 0;
      let teamLat: number | null = null;
      let teamLng: number | null = null;

      for (const member of team.members) {
        const pos = member.user.profile?.position?.toLowerCase();
        if (pos) {
          if (pos.includes('raider')) positionCounts.raider++;
          else if (pos.includes('defender') || pos.includes('corner') || pos.includes('cover')) positionCounts.defender++;
          else if (pos.includes('all-rounder')) positionCounts['all-rounder']++;
        }
        if (member.user.profile?.overallRating) {
          teamAvgRating += member.user.profile.overallRating;
          ratingCount++;
        }
        if (member.user.playerLocation) {
          teamLat = member.user.playerLocation.lat;
          teamLng = member.user.playerLocation.lng;
        }
      }

      teamAvgRating = ratingCount > 0 ? teamAvgRating / ratingCount : 0;

      // Reason 1: Team needs player's position
      if (userPosition) {
        if (userPosition.includes('raider') && positionCounts.raider < 3) {
          reasons.push('Needs a Raider');
          score += 30;
        } else if ((userPosition.includes('defender') || userPosition.includes('corner') || userPosition.includes('cover')) && positionCounts.defender < 4) {
          reasons.push('Needs a Defender');
          score += 30;
        } else if (userPosition.includes('all-rounder') && positionCounts['all-rounder'] < 2) {
          reasons.push('Needs an All-Rounder');
          score += 30;
        }
      }

      // Reason 2: Near user's location
      let distance: number | null = null;
      if (userLocation && teamLat !== null && teamLng !== null) {
        distance = haversineDistance(userLocation.lat, userLocation.lng, teamLat, teamLng);
        if (distance <= 5) {
          reasons.push('Very close to you');
          score += 25;
        } else if (distance <= 15) {
          reasons.push('Near your location');
          score += 15;
        } else if (distance <= 30) {
          reasons.push('In your area');
          score += 5;
        }
      }

      // Reason 3: Similar skill level
      if (teamAvgRating > 0 && userRating > 0) {
        const ratingDiff = Math.abs(teamAvgRating - userRating);
        if (ratingDiff <= 1) {
          reasons.push('Similar skill level');
          score += 20;
        } else if (ratingDiff <= 3) {
          reasons.push('Compatible skill level');
          score += 10;
        }
      }

      // Reason 4: Small team, needs players
      if (team.members.length < 7) {
        reasons.push('Looking for players');
        score += 15;
      }

      // Reason 5: Same city match
      if (user.location && team.members.some((m) => {
        const memberUser = m.user;
        return false; // city data would come from location
      })) {
        // skip this - no city on user directly
      }

      // Only include teams with at least one reason
      if (reasons.length > 0) {
        suggestions.push({
          id: team.id,
          name: team.name,
          shortName: team.shortName,
          teamCode: team.teamCode,
          logo: team.logo,
          color: team.color,
          memberCount: team._count.members,
          reasons,
          score,
          distance: distance !== null ? Math.round(distance * 10) / 10 : null,
        });
      }
    }

    // Sort by score descending, then by distance ascending
    suggestions.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.distance ?? 999) - (b.distance ?? 999);
    });

    return NextResponse.json({ suggestions: suggestions.slice(0, limit) });
  } catch (error) {
    console.error('Team suggestions error:', error);
    return NextResponse.json({ error: 'Failed to get team suggestions' }, { status: 500 });
  }
}

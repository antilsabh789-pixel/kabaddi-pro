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
 * GET /api/nearby-teams?lat=28.6&lng=77.2&radius=25&excludeUserId=xxx
 * Finds teams near the user using team members' PlayerLocation data
 */
export async function GET(req: NextRequest) {
  try {
    const latParam = req.nextUrl.searchParams.get('lat');
    const lngParam = req.nextUrl.searchParams.get('lng');
    const radiusParam = req.nextUrl.searchParams.get('radius') || '25';
    const excludeUserId = req.nextUrl.searchParams.get('excludeUserId');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '30');

    if (!latParam || !lngParam) {
      return NextResponse.json(
        { error: 'lat and lng query parameters are required' },
        { status: 400 }
      );
    }

    const userLat = parseFloat(latParam);
    const userLng = parseFloat(lngParam);
    const radiusKm = parseFloat(radiusParam);

    if (isNaN(userLat) || isNaN(userLng) || isNaN(radiusKm)) {
      return NextResponse.json(
        { error: 'Invalid lat, lng, or radius values' },
        { status: 400 }
      );
    }

    // Strategy 1: Find teams through their members' PlayerLocation data
    const teamMembers = await db.teamMember.findMany({
      include: {
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
            teamCode: true,
            logo: true,
            color: true,
            members: {
              select: { id: true, userId: true },
            },
          },
        },
        user: {
          select: {
            id: true,
            playerLocation: {
              select: { lat: true, lng: true, city: true, area: true },
            },
          },
        },
      },
    });

    // Strategy 2: Find teams through grounds where they have matches
    const grounds = await db.ground.findMany({
      where: {
        lat: { not: null },
        lng: { not: null },
      },
      include: {
        matches: {
          where: { status: { in: ['upcoming', 'live'] } },
          take: 5,
          select: {
            homeTeamId: true,
            awayTeamId: true,
          },
        },
      },
    });

    // Build a map of team -> closest distance
    const teamDistanceMap = new Map<string, { distance: number; city: string | null; area: string | null }>();

    // Process team members' locations
    for (const tm of teamMembers) {
      const loc = tm.user.playerLocation;
      if (!loc) continue;

      const distance = haversineDistance(userLat, userLng, loc.lat, loc.lng);
      if (distance > radiusKm) continue;

      const existing = teamDistanceMap.get(tm.team.id);
      if (!existing || distance < existing.distance) {
        teamDistanceMap.set(tm.team.id, {
          distance: Math.round(distance * 10) / 10,
          city: loc.city,
          area: loc.area,
        });
      }
    }

    // Process grounds
    for (const ground of grounds) {
      if (ground.lat === null || ground.lng === null) continue;
      const distance = haversineDistance(userLat, userLng, ground.lat, ground.lng);
      if (distance > radiusKm) continue;

      for (const match of ground.matches) {
        for (const teamId of [match.homeTeamId, match.awayTeamId]) {
          const existing = teamDistanceMap.get(teamId);
          if (!existing || distance < existing.distance) {
            teamDistanceMap.set(teamId, {
              distance: Math.round(distance * 10) / 10,
              city: ground.city,
              area: null,
            });
          }
        }
      }
    }

    // Fetch full team data for nearby teams
    const teamIds = Array.from(teamDistanceMap.keys());
    const teams = await db.team.findMany({
      where: { id: { in: teamIds } },
      include: {
        _count: { select: { members: true } },
      },
    });

    // Build response
    const result = teams
      .map((team) => {
        const distInfo = teamDistanceMap.get(team.id);
        return {
          id: team.id,
          name: team.name,
          shortName: team.shortName,
          teamCode: team.teamCode,
          logo: team.logo,
          color: team.color,
          memberCount: team._count.members,
          distance: distInfo?.distance ?? 0,
          city: distInfo?.city ?? null,
          area: distInfo?.area ?? null,
        };
      })
      // Exclude teams the user is already in
      .filter(async (t) => {
        if (!excludeUserId) return true;
        const membership = await db.teamMember.findUnique({
          where: { teamId_userId: { teamId: t.id, userId: excludeUserId } },
        });
        return !membership;
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    // Since filter with async doesn't work like that, re-do filtering synchronously
    const memberships = excludeUserId
      ? await db.teamMember.findMany({
          where: { userId: excludeUserId, teamId: { in: teamIds } },
          select: { teamId: true },
        })
      : [];

    const memberTeamIds = new Set(memberships.map((m) => m.teamId));

    const finalResult = teams
      .map((team) => {
        const distInfo = teamDistanceMap.get(team.id);
        return {
          id: team.id,
          name: team.name,
          shortName: team.shortName,
          teamCode: team.teamCode,
          logo: team.logo,
          color: team.color,
          memberCount: team._count.members,
          distance: distInfo?.distance ?? 0,
          city: distInfo?.city ?? null,
          area: distInfo?.area ?? null,
          isMember: memberTeamIds.has(team.id),
        };
      })
      .filter((t) => !t.isMember)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return NextResponse.json({ teams: finalResult });
  } catch (error) {
    console.error('Nearby teams error:', error);
    return NextResponse.json({ error: 'Failed to find nearby teams' }, { status: 500 });
  }
}

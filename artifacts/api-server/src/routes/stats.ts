import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const gender = (req.query['gender'] as string) || 'all';
    // Count EVERY non-admin user as a "player". Previously this filtered by
    // role='player', which silently hid legacy users whose role is still
    // 'coach' (pre-migration) and made the admin dashboard show "0 users"
    // even when the database had real registered users. The admin /players
    // endpoint already counts everyone who isn't an admin — this matches.
    const userWhere: Record<string, unknown> = { isAdmin: false };
    if (gender && gender !== 'all') userWhere.gender = gender;

    const [totalPlayers, totalTeams, totalTournaments, totalMatches, liveMatchCount, completedMatchCount, upcomingMatchCount, aggregateStats] = await Promise.all([
      db.user.count({ where: userWhere }),
      db.team.count(),
      db.tournament.count({ where: { status: { in: ['ongoing', 'upcoming'] } } }),
      db.match.count(),
      db.match.count({ where: { status: 'live' } }),
      db.match.count({ where: { status: 'completed' } }),
      db.match.count({ where: { status: 'upcoming' } }),
      db.playerProfile.aggregate({
        _sum: { raidPoints: true, tacklePoints: true, bonusPoints: true, totalPoints: true, totalRaids: true, successfulRaids: true, totalTackles: true, successfulTackles: true, superTackles: true },
      }),
    ]);

    // ── Feed matches: live, recent completed, upcoming ─────────────────
    // Each includes `scorers: [{ userId }]` so the frontend can render a
    // "Delete" button (admin OR scorer-of-match only). The DELETE endpoint
    // at POST /api/matches re-validates permission server-side, so leaking
    // the userId list here is only for UI affordance, not authorization.
    const matchIncludeForFeed = {
      homeTeam: { select: { id: true, name: true, shortName: true, color: true, logo: true } },
      awayTeam: { select: { id: true, name: true, shortName: true, color: true, logo: true } },
      tournament: { select: { id: true, name: true } },
      scorers: { select: { userId: true } },
    };

    const [liveMatches, recentMatches, upcomingMatches] = await Promise.all([
      db.match.findMany({
        where: { status: 'live' },
        include: matchIncludeForFeed,
        orderBy: { startedAt: 'desc' },
        take: 5,
      }),
      db.match.findMany({
        where: { status: 'completed' },
        include: matchIncludeForFeed,
        orderBy: { completedAt: 'desc' },
        take: 5,
      }),
      db.match.findMany({
        where: { status: 'upcoming' },
        include: matchIncludeForFeed,
        orderBy: { startedAt: 'asc' },
        take: 5,
      }),
    ]);

    const raidSuccessRate = (aggregateStats._sum.totalRaids ?? 0) > 0
      ? Math.round(((aggregateStats._sum.successfulRaids ?? 0) / (aggregateStats._sum.totalRaids ?? 1)) * 100) : 0;
    const tackleSuccessRate = (aggregateStats._sum.totalTackles ?? 0) > 0
      ? Math.round(((aggregateStats._sum.successfulTackles ?? 0) / (aggregateStats._sum.totalTackles ?? 1)) * 100) : 0;

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.json({
      totalPlayers, totalTeams, totalTournaments, totalMatches, liveMatchCount, completedMatchCount, upcomingMatchCount,
      totalRaidPoints: aggregateStats._sum.raidPoints ?? 0,
      totalTacklePoints: aggregateStats._sum.tacklePoints ?? 0,
      raidSuccessRate, tackleSuccessRate,
      liveMatches,
      recentMatches,
      upcomingMatches,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const category = (req.query['category'] as string) || 'raiders';
    const gender = (req.query['gender'] as string) || 'all';
    const limit = parseInt((req.query['limit'] as string) || '20');
    const mode = (req.query['mode'] as string) || 'tournament';
    const isPractice = mode === 'practice';
    const prefix = isPractice ? 'practice' : 'tournament';

    const userWhere: Record<string, unknown> = {};
    if (gender && gender !== 'all') userWhere.gender = gender;

    const profileWhere: Record<string, unknown> = { [`${prefix}Matches`]: { gt: 0 } };

    let orderBy: Record<string, string>;
    switch (category) {
      case 'raiders': orderBy = { [`${prefix}RaidPoints`]: 'desc' }; break;
      case 'defenders': orderBy = { [`${prefix}TacklePoints`]: 'desc' }; break;
      case 'allrounders': orderBy = { [`${prefix}TotalPoints`]: 'desc' }; break;
      case 'mvp': case 'rating': orderBy = { overallRating: 'desc' }; break;
      default: orderBy = { [`${prefix}RaidPoints`]: 'desc' };
    }

    const profiles = await db.playerProfile.findMany({
      where: { user: userWhere, ...profileWhere },
      orderBy,
      take: limit,
      include: { user: { select: { id: true, name: true, avatar: true, gender: true, playerCode: true } } },
    });

    const entries = profiles.map((p, i) => ({
      rank: i + 1,
      userId: p.userId,
      name: p.user.name,
      avatar: p.user.avatar,
      playerCode: p.user.playerCode,
      gender: p.user.gender,
      raidPoints: isPractice ? p.practiceRaidPoints : p.tournamentRaidPoints,
      tacklePoints: isPractice ? p.practiceTacklePoints : p.tournamentTacklePoints,
      totalPoints: isPractice ? p.practiceTotalPoints : p.tournamentTotalPoints,
      matches: isPractice ? p.practiceMatches : p.tournamentMatches,
      overallRating: p.overallRating,
    }));

    return res.json({ entries });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/leaderboard-seasons', async (req, res) => {
  try {
    const seasons = await db.leaderboardSeason.findMany({ orderBy: { startDate: 'desc' }, take: 10 });
    return res.json({ seasons });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/percentile-rankings', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const profile = await db.playerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const [totalPlayers, aboveRaid, aboveTackle, aboveTotal] = await Promise.all([
      db.playerProfile.count(),
      db.playerProfile.count({ where: { raidPoints: { lt: profile.raidPoints } } }),
      db.playerProfile.count({ where: { tacklePoints: { lt: profile.tacklePoints } } }),
      db.playerProfile.count({ where: { totalPoints: { lt: profile.totalPoints } } }),
    ]);

    return res.json({
      raidPercentile: totalPlayers > 1 ? Math.round((aboveRaid / (totalPlayers - 1)) * 100) : 100,
      tacklePercentile: totalPlayers > 1 ? Math.round((aboveTackle / (totalPlayers - 1)) * 100) : 100,
      totalPercentile: totalPlayers > 1 ? Math.round((aboveTotal / (totalPlayers - 1)) * 100) : 100,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const q = ((req.query['q'] as string) || '').trim();
    const type = (req.query['type'] as string) || 'all';
    if (!q || q.length < 1) return res.json({ players: [], teams: [], tournaments: [], matches: [] });

    const filterType = ['all', 'players', 'teams', 'tournaments', 'matches'].includes(type) ? type : 'all';

    const [players, teams, tournaments, matches] = await Promise.all([
      (filterType === 'all' || filterType === 'players')
        ? db.user.findMany({ where: { OR: [{ name: { contains: q } }, { playerCode: { contains: q } }] }, take: 5, include: { profile: { select: { position: true } }, teams: { include: { team: { select: { name: true } } }, take: 1 } } })
        : [],
      (filterType === 'all' || filterType === 'teams')
        ? db.team.findMany({ where: { OR: [{ name: { contains: q } }, { teamCode: { contains: q } }] }, take: 5, include: { _count: { select: { members: true } } } })
        : [],
      (filterType === 'all' || filterType === 'tournaments')
        ? db.tournament.findMany({ where: { OR: [{ name: { contains: q } }, { tournamentCode: { contains: q } }] }, take: 5 })
        : [],
      (filterType === 'all' || filterType === 'matches')
        ? db.match.findMany({ where: { OR: [{ homeTeam: { name: { contains: q } } }, { awayTeam: { name: { contains: q } } }] }, take: 5, include: { homeTeam: { select: { name: true, shortName: true, color: true } }, awayTeam: { select: { name: true, shortName: true, color: true } } } })
        : [],
    ]);

    return res.json({
      players: (players as typeof players).map((p: any) => ({ id: p.id, name: p.name, playerCode: p.playerCode, avatar: p.avatar, position: p.profile?.position || null, teamNames: p.teams?.map((t: any) => t.team.name) || [] })),
      teams: (teams as typeof teams).map((t: any) => ({ id: t.id, name: t.name, shortName: t.shortName, color: t.color, teamCode: t.teamCode, memberCount: t._count?.members || 0 })),
      tournaments: (tournaments as typeof tournaments).map((t: any) => ({ id: t.id, name: t.name, type: t.type, status: t.status, tournamentCode: t.tournamentCode })),
      matches: (matches as typeof matches).map((m: any) => ({ id: m.id, homeTeamName: m.homeTeam?.name, awayTeamName: m.awayTeam?.name, homeScore: m.homeScore, awayScore: m.awayScore, status: m.status })),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/nearby-players', async (req, res) => {
  try {
    const lat = parseFloat((req.query['lat'] as string) || '0');
    const lng = parseFloat((req.query['lng'] as string) || '0');
    const radius = parseFloat((req.query['radius'] as string) || '50');
    const limit = parseInt((req.query['limit'] as string) || '10');

    const locations = await db.playerLocation.findMany({ include: { user: { select: { id: true, name: true, avatar: true, playerCode: true, profile: true } } }, take: limit });
    const nearby = locations.filter((l) => {
      const d = Math.sqrt(Math.pow(l.lat - lat, 2) + Math.pow(l.lng - lng, 2)) * 111;
      return d <= radius;
    });
    return res.json({ players: nearby.map((l) => ({ ...l.user, distance: Math.round(Math.sqrt(Math.pow(l.lat - lat, 2) + Math.pow(l.lng - lng, 2)) * 111), city: l.city })) });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/nearby-teams', async (req, res) => {
  try {
    const radiusRaw = (req.query['radius'] as string) || 'everywhere';
    const isEverywhere = radiusRaw === 'everywhere' || radiusRaw === 'all';
    const radiusKm = isEverywhere ? Infinity : parseFloat(radiusRaw) || 50;
    const userLat = parseFloat((req.query['lat'] as string) || '0');
    const userLng = parseFloat((req.query['lng'] as string) || '0');
    const excludeUserId = (req.query['excludeUserId'] as string) || '';

    const where: Record<string, unknown> = {};
    if (excludeUserId) {
      where.members = { none: { userId: excludeUserId } };
    }

    const teams = await db.team.findMany({
      where,
      include: {
        _count: { select: { members: true } },
        members: { take: 1, select: { user: { select: { id: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const formatted = teams.map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      teamCode: t.teamCode,
      logo: t.logo,
      color: t.color,
      memberCount: t._count.members,
      distance: 0,
      city: null,
      area: null,
      groundName: null,
      isMember: false,
    }));

    return res.json({ teams: formatted });
  } catch (error) {
    console.error('nearby-teams error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Haversine distance (km) between two lat/lng points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

router.get('/nearby-tournaments', async (req, res) => {
  try {
    const radiusRaw = (req.query['radius'] as string) || 'everywhere';
    const status = (req.query['status'] as string) || '';
    const isEverywhere = radiusRaw === 'everywhere' || radiusRaw === 'all';
    const radiusKm = isEverywhere ? Infinity : parseFloat(radiusRaw) || 50;
    const userLat = parseFloat((req.query['lat'] as string) || '0');
    const userLng = parseFloat((req.query['lng'] as string) || '0');

    // Build where clause for status filter
    const where: Record<string, unknown> = {};
    if (status === 'upcoming') where.status = 'upcoming';
    else if (status === 'ongoing') where.status = 'ongoing';
    else where.status = { in: ['upcoming', 'ongoing', 'completed'] };

    // Fetch all matching tournaments — no take limit so "everywhere" really shows everything.
    // Limit to 500 to avoid pathological cases.
    const tournaments = await db.tournament.findMany({
      where,
      include: {
        organizer: { select: { id: true, name: true } },
        entries: { select: { id: true } },
      },
      orderBy: { startDate: 'asc' },
      take: 500,
    });

    const formatted = tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      tournamentCode: t.tournamentCode,
      status: t.status,
      type: t.type,
      gender: t.gender,
      weightCategory: t.weightCategory,
      startDate: t.startDate,
      endDate: t.endDate,
      venue: t.venue,
      groundName: t.venue || null,
      groundCity: null,
      teamCount: t.entries.length,
      // Tournaments don't carry lat/lng in the schema, so we can't compute real distance.
      distance: null as number | null,
    }));

    return res.json({ tournaments: formatted });
  } catch (error) {
    console.error('nearby-tournaments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/nearby-grounds', async (req, res) => {
  try {
    const radiusRaw = (req.query['radius'] as string) || 'everywhere';
    const isEverywhere = radiusRaw === 'everywhere' || radiusRaw === 'all';
    const radiusKm = isEverywhere ? Infinity : parseFloat(radiusRaw) || 50;
    const userLat = parseFloat((req.query['lat'] as string) || '0');
    const userLng = parseFloat((req.query['lng'] as string) || '0');

    const grounds = await db.ground.findMany({
      include: { _count: { select: { matches: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const withDistance = grounds
      .map((g) => {
        const distance = (g.lat !== null && g.lng !== null)
          ? haversineKm(userLat, userLng, g.lat, g.lng)
          : 0;
        return {
          id: g.id,
          name: g.name,
          address: g.address,
          city: g.city,
          state: g.state,
          surface: g.surface,
          amenities: g.amenities,
          lat: g.lat,
          lng: g.lng,
          matchCount: g._count.matches,
          distance: Math.round(distance * 10) / 10,
        };
      })
      .filter((g) => isEverywhere || g.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    return res.json({ grounds: withDistance });
  } catch (error) {
    console.error('nearby-grounds error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/grounds', async (req, res) => {
  try {
    const search = (req.query['search'] as string) || '';
    const surface = (req.query['surface'] as string) || '';
    const amenity = (req.query['amenity'] as string) || '';
    const sort = (req.query['sort'] as string) || 'newest';
    const userLat = parseFloat((req.query['lat'] as string) || '0');
    const userLng = parseFloat((req.query['lng'] as string) || '0');

    const where: Record<string, unknown> = {};
    if (surface && surface !== 'all') where.surface = surface;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (amenity) {
      // amenities is a JSON array stored as text — use contains match
      where.amenities = { contains: amenity };
    }

    const grounds = await db.ground.findMany({
      where,
      include: {
        _count: { select: { matches: true } },
        matches: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            homeTeam: { select: { name: true, shortName: true, color: true } },
            awayTeam: { select: { name: true, shortName: true, color: true } },
            tournament: { select: { name: true } },
          },
        },
      },
      orderBy: sort === 'popular'
        ? { matches: { _count: 'desc' } }
        : { createdAt: 'desc' },
      take: 500,
    });

    const withDistance = grounds.map((g) => ({
      ...g,
      _count: g._count,
      distance: (g.lat !== null && g.lng !== null)
        ? Math.round(haversineKm(userLat, userLng, g.lat, g.lng) * 10) / 10
        : null,
    }));

    if (sort === 'nearest') {
      withDistance.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }

    return res.json({ grounds: withDistance });
  } catch (error) {
    console.error('grounds fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/grounds', async (req, res) => {
  try {
    const { name, address, city, state, surface, amenities, addedBy } = req.body;
    const mapLink: string | undefined = req.body.mapLink;
    const { latitude, longitude } = req.body;

    // Parse lat/lng: accept explicit values, OR extract from a Google Maps URL.
    let lat: number | null = null;
    let lng: number | null = null;
    if (typeof req.body.lat === 'number' || (typeof req.body.lat === 'string' && req.body.lat.trim())) {
      const v = parseFloat(req.body.lat);
      if (!Number.isNaN(v)) lat = v;
    }
    if (typeof req.body.lng === 'number' || (typeof req.body.lng === 'string' && req.body.lng.trim())) {
      const v = parseFloat(req.body.lng);
      if (!Number.isNaN(v)) lng = v;
    }
    if (latitude !== undefined) {
      const v = parseFloat(latitude);
      if (!Number.isNaN(v)) lat = v;
    }
    if (longitude !== undefined) {
      const v = parseFloat(longitude);
      if (!Number.isNaN(v)) lng = v;
    }

    // Extract coordinates from a Google Maps URL if direct lat/lng not provided.
    // Supports: @lat,lng (place URLs), ?q=lat,lng, &query=lat,lng (search URLs).
    if (mapLink && (lat === null || lng === null)) {
      try {
        const atMatch = mapLink.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
        if (atMatch) {
          lat = parseFloat(atMatch[1]);
          lng = parseFloat(atMatch[2]);
        } else {
          const qMatch = mapLink.match(/[?&](?:q|query)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
          if (qMatch) {
            lat = parseFloat(qMatch[1]);
            lng = parseFloat(qMatch[2]);
          }
        }
      } catch {
        // Ignore parse errors — lat/lng stay null, which is fine (mapLink still saved)
      }
    }

    if (!name) return res.status(400).json({ error: 'name is required' });

    // Amenities may arrive as an array (from the new form) or already-stringified JSON.
    const amenitiesValue: string | null = Array.isArray(amenities)
      ? JSON.stringify(amenities)
      : (typeof amenities === 'string' ? amenities : null);

    const ground = await db.ground.create({
      data: {
        name,
        address: address || null,
        city: city || null,
        state: state || null,
        lat,
        lng,
        mapLink: mapLink || null,
        surface: surface || null,
        amenities: amenitiesValue,
        addedBy: addedBy || null,
      },
    });
    return res.json({ ground });
  } catch (error) {
    console.error('create ground error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/grounds/:id
 * Body or query: { userId } — the caller's user ID.
 *
 * Authorization:
 *   - The user who originally added the ground (`addedBy` matches `userId`), OR
 *   - Any admin (`isAdmin: true` on the User record)
 *
 * Both can delete any ground. This is intentional — the spec says "who added
 * academy can delete it and admin also delete any of them".
 *
 * Returns: { success: true, deleted: <groundId> }
 */
router.delete('/grounds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.body?.userId ?? req.query['userId']) as string | undefined;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Fetch the caller so we can check admin status.
    const caller = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isAdmin: true },
    });
    if (!caller) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch the ground to check ownership.
    const ground = await db.ground.findUnique({
      where: { id },
      select: { id: true, addedBy: true, name: true },
    });
    if (!ground) {
      return res.status(404).json({ error: 'Ground not found' });
    }

    const isOwner = ground.addedBy === userId;
    const isAdmin = caller.isAdmin === true;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only the user who added this ground or an admin can delete it' });
    }

    // Cascade-delete is configured on Match.groundId in schema.prisma (onDelete: SetNull
    // for matches, see Match model), so this is safe. We use delete which throws if the
    // row has restrictive FKs.
    await db.ground.delete({ where: { id } });

    return res.json({ success: true, deleted: id, name: ground.name });
  } catch (error) {
    console.error('delete ground error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/academies/public
 *
 * Returns ALL academies (from Coach Corner) for display on the public
 * Find Ground / Academy screen. Each academy is normalized to look like a
 * Ground record so the frontend can render both in one list/map.
 *
 * The Academy model has: name, location (text address — freeform),
 * groundName, coachUserId. There is no lat/lng/mapLink column on Academy.
 * We try to extract coordinates from the `location` text (if it happens to
 * contain a Google Maps URL) — otherwise the academy is shown with no
 * coordinates and the user can still tap it to view details. The frontend
 * will offer a "Open in Google Maps" button that searches the address text
 * on maps.google.com as a fallback when no direct mapLink is available.
 *
 * No auth required — academy names and cities are already public (they appear
 * on coach profiles and tournament pages).
 */
router.get('/academies/public', async (req, res) => {
  try {
    const academies = await db.academy.findMany({
      include: {
        coachUser: { select: { id: true, name: true, phone: true, avatar: true } },
        _count: { select: { players: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Normalize each academy to a "ground-like" shape.
    const normalized = academies.map((a) => {
      // Try to extract a Google Maps URL or coordinates from the location string.
      // Coaches may have pasted a maps link into the location field.
      const locStr = a.location || '';
      let mapLink: string | null = null;
      let lat: number | null = null;
      let lng: number | null = null;

      if (locStr) {
        // Case 1: the location is itself a URL
        if (/^https?:\/\//i.test(locStr)) {
          mapLink = locStr;
          const atMatch = locStr.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
          if (atMatch) {
            lat = parseFloat(atMatch[1]);
            lng = parseFloat(atMatch[2]);
          } else {
            const qMatch = locStr.match(/[?&](?:q|query)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
            if (qMatch) {
              lat = parseFloat(qMatch[1]);
              lng = parseFloat(qMatch[2]);
            }
          }
        } else {
          // Case 2: the location is a plain text address (e.g. "Kothrud, Pune")
          // No coordinates — frontend will offer a "Search on Google Maps" link
          // built from the URL-encoded address.
        }
      }

      return {
        id: a.id,
        name: a.name,
        address: a.location || null,
        city: null,
        state: null,
        surface: null,
        amenities: null,
        lat,
        lng,
        mapLink,
        createdAt: a.createdAt.toISOString(),
        // Extra fields specific to academies
        isAcademy: true,
        coachUserId: a.coachUserId,
        coachName: a.coachUser?.name || null,
        coachAvatar: a.coachUser?.avatar || null,
        groundName: a.groundName || null,
        playerCount: a._count?.players ?? 0,
        addedBy: a.coachUserId, // for delete-permission checks
        _count: { matches: 0 },
        matches: [],
      };
    });

    return res.json({ academies: normalized });
  } catch (error) {
    console.error('public academies fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/academies/:id
 * Body: { userId }
 *
 * Authorization:
 *   - The coach who created the academy (`coachUserId` matches `userId`), OR
 *   - Any admin.
 */
router.delete('/academies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.body?.userId ?? req.query['userId']) as string | undefined;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const caller = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isAdmin: true },
    });
    if (!caller) {
      return res.status(404).json({ error: 'User not found' });
    }

    const academy = await db.academy.findUnique({
      where: { id },
      select: { id: true, coachUserId: true, name: true },
    });
    if (!academy) {
      return res.status(404).json({ error: 'Academy not found' });
    }

    const isOwner = academy.coachUserId === userId;
    const isAdmin = caller.isAdmin === true;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only the coach who created this academy or an admin can delete it' });
    }

    // Academy has cascade deletes configured (players, attendance, etc.)
    await db.academy.delete({ where: { id } });

    return res.json({ success: true, deleted: id, name: academy.name });
  } catch (error) {
    console.error('delete academy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

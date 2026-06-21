/**
 * Mock data for the home tab when the backend is unreachable.
 *
 * Same pattern as authClient.ts: the real API is tried first; if it returns
 * 404 or throws, we fall back to canned sample data so the home page renders
 * populated sections (Popular Players, Leaderboard, Awards, Live Matches).
 *
 * DEMO-ONLY. When the real backend is reachable, these mocks are bypassed.
 */

// ─── Types (mirror the API responses) ─────────────────────────────────

export interface MockPlayer {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  playerCode: string | null;
  gender: string | null;
  position: string | null;
  overallRating: number;
  totalPoints: number;
  totalMatches: number;
  raidPoints: number;
  tacklePoints: number;
  followerCount: number;
  teamNames: string[];
  isFollowing: boolean;
}

export interface MockLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  playerCode: string | null;
  gender: string | null;
  position: string | null;
  totalPoints: number;
  totalMatches: number;
  raidPoints: number;
  tacklePoints: number;
  overallRating: number;
}

export interface MockTopPlayer {
  id: string;
  name: string;
  user: { name: string };
  successfulRaids: number;
  successfulTackles: number;
  totalPoints: number;
  totalMatches: number;
  overallRating: number;
  raidPoints: number;
  tacklePoints: number;
  bonusPoints: number;
  superTackles: number;
  position: string | null;
}

export interface MockLiveMatch {
  id: string;
  homeTeam: {
    id: string;
    name: string;
    shortName: string | null;
    color: string | null;
    logo?: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    shortName: string | null;
    color: string | null;
    logo?: string | null;
  };
  homeScore: number;
  awayScore: number;
  half: number;
  status: string;
  gender: string | null;
  weightCategory: string | null;
  tournament: { id: string; name: string } | null;
}

export interface MockStatsData {
  liveMatches: MockLiveMatch[];
  topRaiders: MockTopPlayer[];
  topDefenders: MockTopPlayer[];
  totalPlayers: number;
  totalMatches: number;
  totalTournaments: number;
  featuredTournament?: {
    id: string;
    name: string;
    logo: string;
    teamsCount: number;
    matchesCount: number;
    status: string;
  };
}

// ─── Sample data ──────────────────────────────────────────────────────

const TEAM_NAMES = [
  'Bengal Warriors', 'Patna Pirates', 'Bengaluru Bulls', 'Dabang Delhi',
  'Jaipur Pink Panthers', 'U Mumba', 'Telugu Titans', 'Gujarat Giants',
  'Haryana Steelers', 'Tamil Thalaivas', 'Puneri Paltan', 'UP Yoddha',
];

const PLAYER_NAMES = [
  'Arjun Singh', 'Vikram Patel', 'Rahul Kumar', 'Sandeep Nayak', 'Deepak Hooda',
  'Pardeep Narwal', 'Maninder Singh', 'Pawan Sehrawat', 'Naveen Kumar', 'Sachin Tanwar',
  'Abozar Mohajer', 'Fazel Atrachali', 'Surjeet Singh', 'Ravinder Pahal', 'Surender Gill',
  'Rishank Devadiga', 'Ajay Thakur', 'Rohit Kumar', 'K. Prapanjan', 'Meraj Sheykh',
];

const POSITIONS: (string | null)[] = ['raider', 'left-cover', 'right-corner', 'all-rounder', null];

const AVATAR_SEEDS = ['kabaddi-1', 'kabaddi-2', 'kabaddi-3', 'kabaddi-4', 'kabaddi-5'];

let _seededPlayers: MockPlayer[] | null = null;
function getSeededPlayers(): MockPlayer[] {
  if (_seededPlayers) return _seededPlayers;
  _seededPlayers = PLAYER_NAMES.slice(0, 12).map((name, i) => ({
    rank: i + 1,
    userId: `mock_player_${i + 1}`,
    name,
    avatar: `https://picsum.photos/seed/${AVATAR_SEEDS[i % AVATAR_SEEDS.length]}/80/80`,
    playerCode: `KP${100000 + i * 137}`,
    gender: i % 7 === 0 ? 'female' : 'male',
    position: POSITIONS[i % POSITIONS.length],
    overallRating: 8.5 - i * 0.2,
    totalPoints: 850 - i * 45,
    totalMatches: 25 + i,
    raidPoints: 600 - i * 35,
    tacklePoints: 250 - i * 15,
    followerCount: 1200 - i * 80,
    teamNames: [TEAM_NAMES[i % TEAM_NAMES.length]],
    isFollowing: false,
  }));
  return _seededPlayers;
}

// ─── Mock response builders ───────────────────────────────────────────

export function mockPopularPlayers(limit: number = 10): { players: MockPlayer[] } {
  return { players: getSeededPlayers().slice(0, limit) };
}

export function mockLeaderboard(category: string, limit: number = 10): { leaderboard: MockLeaderboardEntry[] } {
  const players = getSeededPlayers();
  // Filter by category if needed (raider/defender/all-rounder)
  let filtered = players;
  if (category === 'raider') {
    filtered = players.filter((p) => p.position?.includes('raider') || p.position === 'all-rounder');
  } else if (category === 'defender') {
    filtered = players.filter((p) => p.position?.includes('corner') || p.position?.includes('cover'));
  } else if (category === 'all-rounder') {
    filtered = players.filter((p) => p.position === 'all-rounder');
  }
  if (filtered.length === 0) filtered = players;
  return {
    leaderboard: filtered.slice(0, limit).map((p) => ({
      rank: p.rank,
      userId: p.userId,
      name: p.name,
      avatar: p.avatar,
      playerCode: p.playerCode,
      gender: p.gender,
      position: p.position,
      totalPoints: p.totalPoints,
      totalMatches: p.totalMatches,
      raidPoints: p.raidPoints,
      tacklePoints: p.tacklePoints,
      overallRating: p.overallRating,
    })),
  };
}

export function mockStats(): MockStatsData {
  const players = getSeededPlayers();
  // Top raiders = sorted by raidPoints
  const topRaiders = [...players]
    .sort((a, b) => b.raidPoints - a.raidPoints)
    .slice(0, 5)
    .map((p, i) => ({
      id: p.userId,
      name: p.name,
      user: { name: p.name },
      successfulRaids: Math.floor(p.raidPoints * 0.7),
      successfulTackles: Math.floor(p.tacklePoints * 0.6),
      totalPoints: p.totalPoints,
      totalMatches: p.totalMatches,
      overallRating: p.overallRating,
      raidPoints: p.raidPoints,
      tacklePoints: p.tacklePoints,
      bonusPoints: Math.floor(p.totalPoints * 0.1),
      superTackles: Math.floor(p.tacklePoints * 0.05),
      position: p.position,
    }));
  // Top defenders = sorted by tacklePoints
  const topDefenders = [...players]
    .sort((a, b) => b.tacklePoints - a.tacklePoints)
    .slice(0, 5)
    .map((p, i) => ({
      id: p.userId,
      name: p.name,
      user: { name: p.name },
      successfulRaids: Math.floor(p.raidPoints * 0.7),
      successfulTackles: Math.floor(p.tacklePoints * 0.6),
      totalPoints: p.totalPoints,
      totalMatches: p.totalMatches,
      overallRating: p.overallRating,
      raidPoints: p.raidPoints,
      tacklePoints: p.tacklePoints,
      bonusPoints: Math.floor(p.totalPoints * 0.1),
      superTackles: Math.floor(p.tacklePoints * 0.05),
      position: p.position,
    }));

  return {
    liveMatches: [
      {
        id: 'mock_live_1',
        homeTeam: {
          id: 'mock_team_1',
          name: 'Bengal Warriors',
          shortName: 'BEN',
          color: '#DC2626',
        },
        awayTeam: {
          id: 'mock_team_2',
          name: 'Patna Pirates',
          shortName: 'PAT',
          color: '#F59E0B',
        },
        homeScore: 18,
        awayScore: 15,
        half: 2,
        status: 'live',
        gender: 'male',
        weightCategory: null,
        tournament: { id: 'mock_t_1', name: 'Pro Kabaddi League 2025' },
      },
      {
        id: 'mock_live_2',
        homeTeam: {
          id: 'mock_team_3',
          name: 'Jaipur Pink Panthers',
          shortName: 'JAI',
          color: '#EC4899',
        },
        awayTeam: {
          id: 'mock_team_4',
          name: 'U Mumba',
          shortName: 'MUM',
          color: '#0EA5E9',
        },
        homeScore: 12,
        awayScore: 14,
        half: 1,
        status: 'live',
        gender: 'male',
        weightCategory: null,
        tournament: { id: 'mock_t_1', name: 'Pro Kabaddi League 2025' },
      },
    ],
    topRaiders,
    topDefenders,
    totalPlayers: 12453,
    totalMatches: 8721,
    totalTournaments: 47,
    featuredTournament: {
      id: 'mock_t_1',
      name: 'Pro Kabaddi League 2025',
      logo: '',
      teamsCount: 12,
      matchesCount: 137,
      status: 'ongoing',
    },
  };
}

// ─── Public helpers ───────────────────────────────────────────────────

/**
 * Build a mock player profile response for `/api/players/:id`.
 * Looks up the player by userId in the seeded mock players list. If not
 * found (e.g. the id is the current user's local id), returns a generic
 * profile built from the id itself.
 */
export function mockPlayerProfile(userId: string): {
  player: {
    id: string;
    name: string;
    avatar: string | null;
    playerCode: string | null;
    gender: string | null;
    role: string;
    isPremium: boolean;
    weight: string | null;
    practiceGround: string | null;
  };
  profile: {
    position: string | null;
    overallRating: number;
    totalPoints: number;
    totalMatches: number;
    raidPoints: number;
    tacklePoints: number;
    totalRaids: number;
    successfulRaids: number;
    totalTackles: number;
    successfulTackles: number;
    bonusPoints: number;
    superTackles: number;
    tournamentMatches: number;
    tournamentTotalPoints: number;
    tournamentRaidPoints: number;
    tournamentTacklePoints: number;
    practiceMatches: number;
    practiceTotalPoints: number;
    practiceRaidPoints: number;
    practiceTacklePoints: number;
    jerseyNumber: number | null;
  };
  teamNames: string[];
} {
  const players = getSeededPlayers();
  const found = players.find((p) => p.userId === userId);
  const p = found || {
    userId,
    name: 'Kabaddi Player',
    avatar: `https://picsum.photos/seed/${encodeURIComponent(userId)}/80/80`,
    playerCode: `KP${userId.slice(-6).replace(/\D/g, '').padStart(6, '0') || '000000'}`,
    gender: 'male' as string | null,
    position: 'all-rounder' as string | null,
    overallRating: 7.5,
    totalPoints: 320,
    totalMatches: 12,
    raidPoints: 220,
    tacklePoints: 100,
  };
  return {
    player: {
      id: p.userId,
      name: p.name,
      avatar: p.avatar,
      playerCode: p.playerCode,
      gender: p.gender,
      role: 'player',
      isPremium: false,
      weight: '70kg',
      practiceGround: 'Local Academy',
    },
    profile: {
      position: p.position,
      overallRating: p.overallRating,
      totalPoints: p.totalPoints,
      totalMatches: p.totalMatches,
      raidPoints: p.raidPoints,
      tacklePoints: p.tacklePoints,
      totalRaids: Math.floor(p.raidPoints / 3),
      successfulRaids: Math.floor(p.raidPoints / 4),
      totalTackles: Math.floor(p.tacklePoints / 2),
      successfulTackles: Math.floor(p.tacklePoints / 3),
      bonusPoints: Math.floor(p.totalPoints * 0.1),
      superTackles: Math.floor(p.tacklePoints * 0.05),
      tournamentMatches: Math.floor(p.totalMatches * 0.7),
      tournamentTotalPoints: Math.floor(p.totalPoints * 0.7),
      tournamentRaidPoints: Math.floor(p.raidPoints * 0.7),
      tournamentTacklePoints: Math.floor(p.tacklePoints * 0.7),
      practiceMatches: Math.floor(p.totalMatches * 0.3),
      practiceTotalPoints: Math.floor(p.totalPoints * 0.3),
      practiceRaidPoints: Math.floor(p.raidPoints * 0.3),
      practiceTacklePoints: Math.floor(p.tacklePoints * 0.3),
      jerseyNumber: Math.floor(Math.random() * 99) + 1,
    },
    teamNames: TEAM_NAMES.slice(0, 1),
  };
}

/**
 * Build a mock match-events response for `/api/match-events?matchId=...`.
 * Returns a live match with 2 teams, 7 players each, and a handful of
 * events so the MatchDayExperience renders something useful.
 */
export function mockMatchEvents(matchId: string): {
  match: {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeam: string;
    awayTeam: string;
    homeTeamColor: string;
    awayTeamColor: string;
    currentHalf: number;
    halfDuration: number;
    homeScore: number;
    awayScore: number;
    playersPerSide: number;
    homePlayers: Array<{
      id: string;
      name: string;
      phone?: string;
      avatar?: string;
      jerseyNumber?: number;
      position?: string;
      playerCode?: string;
      isCaptain: boolean;
      teamId: string;
    }>;
    awayPlayers: Array<{
      id: string;
      name: string;
      phone?: string;
      avatar?: string;
      jerseyNumber?: number;
      position?: string;
      playerCode?: string;
      isCaptain: boolean;
      teamId: string;
    }>;
    status?: string;
  };
  events: Array<{
    id: string;
    matchId: string;
    teamId: string;
    playerId?: string;
    eventType: string;
    value: number;
    details?: string;
    half: number;
    timestamp: number;
    playerName?: string;
  }>;
} {
  const players = getSeededPlayers();
  const homePlayers = players.slice(0, 7).map((p, i) => ({
    id: p.userId,
    name: p.name,
    avatar: p.avatar || undefined,
    jerseyNumber: i + 1,
    position: p.position || 'raider',
    playerCode: p.playerCode || undefined,
    isCaptain: i === 0,
    teamId: 'mock_home_team',
  }));
  const awayPlayers = players.slice(7, 14).map((p, i) => ({
    id: p.userId,
    name: p.name,
    avatar: p.avatar || undefined,
    jerseyNumber: i + 1,
    position: p.position || 'raider',
    playerCode: p.playerCode || undefined,
    isCaptain: i === 0,
    teamId: 'mock_away_team',
  }));

  const homeScore = 14;
  const awayScore = 11;
  const now = Date.now();
  const events = [
    { id: 'mock_ev_1', matchId, teamId: 'mock_home_team', playerId: homePlayers[0].id, eventType: 'raid_point', value: 1, half: 1, timestamp: now - 600000, playerName: homePlayers[0].name },
    { id: 'mock_ev_2', matchId, teamId: 'mock_away_team', playerId: awayPlayers[1].id, eventType: 'tackle_point', value: 1, half: 1, timestamp: now - 540000, playerName: awayPlayers[1].name },
    { id: 'mock_ev_3', matchId, teamId: 'mock_home_team', playerId: homePlayers[1].id, eventType: 'raid_point', value: 2, half: 1, timestamp: now - 480000, playerName: homePlayers[1].name, details: 'Super Raid' },
    { id: 'mock_ev_4', matchId, teamId: 'mock_home_team', playerId: homePlayers[2].id, eventType: 'bonus_point', value: 1, half: 1, timestamp: now - 420000, playerName: homePlayers[2].name },
    { id: 'mock_ev_5', matchId, teamId: 'mock_away_team', playerId: awayPlayers[0].id, eventType: 'raid_point', value: 1, half: 1, timestamp: now - 360000, playerName: awayPlayers[0].name },
    { id: 'mock_ev_6', matchId, teamId: 'mock_home_team', playerId: homePlayers[3].id, eventType: 'tackle_point', value: 1, half: 1, timestamp: now - 300000, playerName: homePlayers[3].name },
    { id: 'mock_ev_7', matchId, teamId: 'mock_away_team', playerId: awayPlayers[2].id, eventType: 'raid_point', value: 1, half: 2, timestamp: now - 240000, playerName: awayPlayers[2].name },
    { id: 'mock_ev_8', matchId, teamId: 'mock_home_team', playerId: homePlayers[0].id, eventType: 'raid_point', value: 1, half: 2, timestamp: now - 180000, playerName: homePlayers[0].name },
    { id: 'mock_ev_9', matchId, teamId: 'mock_away_team', playerId: awayPlayers[1].id, eventType: 'tackle_point', value: 1, half: 2, timestamp: now - 120000, playerName: awayPlayers[1].name, details: 'Super Tackle' },
    { id: 'mock_ev_10', matchId, teamId: 'mock_home_team', playerId: homePlayers[1].id, eventType: 'raid_point', value: 1, half: 2, timestamp: now - 60000, playerName: homePlayers[1].name },
  ];

  return {
    match: {
      id: matchId,
      homeTeamId: 'mock_home_team',
      awayTeamId: 'mock_away_team',
      homeTeam: 'Bengal Warriors',
      awayTeam: 'Patna Pirates',
      homeTeamColor: '#DC2626',
      awayTeamColor: '#F59E0B',
      currentHalf: 2,
      halfDuration: 20,
      homeScore,
      awayScore,
      playersPerSide: 7,
      homePlayers,
      awayPlayers,
      status: 'live',
    },
    events,
  };
}

/**
 * Build a mock match-details response for `/api/matches?id=...`.
 * Used by MatchDetailsScreen for completed/recent matches.
 */
export function mockMatchDetails(matchId: string): {
  match: {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    homeTeam: { id: string; name: string; shortName?: string; color?: string };
    awayTeam: { id: string; name: string; shortName?: string; color?: string };
    events: Array<{
      id: string;
      matchId: string;
      teamId: string;
      playerId?: string;
      eventType: string;
      value: number;
      details?: string;
      half: number;
      timestamp: string;
    }>;
    scorers: Array<{ id: string; matchId: string; userId: string; user: { id: string; name: string; avatar?: string } }>;
    motmUser: { id: string; name: string; avatar?: string } | null;
    tournament: { id: string; name: string } | null;
    status: string;
    gender: string | null;
    startedAt: string | null;
    completedAt: string | null;
    halfDuration: number;
    playersPerSide: number;
    isPractice: boolean;
    venue: string | null;
    ground: string | null;
    weightCategory: string | null;
  };
} {
  const players = getSeededPlayers();
  const topScorer = players[0];
  const startedAt = new Date(Date.now() - 7200000).toISOString();
  const completedAt = new Date(Date.now() - 3600000).toISOString();
  return {
    match: {
      id: matchId,
      homeTeamId: 'mock_home_team',
      awayTeamId: 'mock_away_team',
      homeScore: 24,
      awayScore: 19,
      homeTeam: { id: 'mock_home_team', name: 'Bengal Warriors', shortName: 'BEN', color: '#DC2626' },
      awayTeam: { id: 'mock_away_team', name: 'Patna Pirates', shortName: 'PAT', color: '#F59E0B' },
      events: [
        { id: 'mock_mdev_1', matchId, teamId: 'mock_home_team', playerId: topScorer.userId, eventType: 'raid_point', value: 1, half: 1, timestamp: new Date(Date.now() - 7000000).toISOString() },
        { id: 'mock_mdev_2', matchId, teamId: 'mock_away_team', playerId: players[1].userId, eventType: 'tackle_point', value: 1, half: 1, timestamp: new Date(Date.now() - 6600000).toISOString() },
        { id: 'mock_mdev_3', matchId, teamId: 'mock_home_team', playerId: topScorer.userId, eventType: 'raid_point', value: 2, half: 2, timestamp: new Date(Date.now() - 5000000).toISOString(), details: 'Super Raid' },
        { id: 'mock_mdev_4', matchId, teamId: 'mock_away_team', playerId: players[1].userId, eventType: 'raid_point', value: 1, half: 2, timestamp: new Date(Date.now() - 4000000).toISOString() },
      ],
      scorers: [
        { id: 'mock_scorer_1', matchId, userId: topScorer.userId, user: { id: topScorer.userId, name: topScorer.name, avatar: topScorer.avatar || undefined } },
      ],
      motmUser: { id: topScorer.userId, name: topScorer.name, avatar: topScorer.avatar || undefined },
      tournament: { id: 'mock_t_1', name: 'Pro Kabaddi League 2025' },
      status: 'completed',
      gender: 'male',
      startedAt,
      completedAt,
      halfDuration: 20,
      playersPerSide: 7,
      isPractice: false,
      venue: 'Salt Lake Stadium, Kolkata',
      ground: null,
      weightCategory: null,
    },
  };
}

/**
 * Fetch with 404 / network-error fallback to a mock provider.
 *
 * @param url The URL to fetch
 * @param mockFn Function that returns the mock data if real fetch fails
 * @returns { ok, status, data } — same shape as a real fetch + .json()
 */
export async function fetchWithMock<T>(
  url: string,
  mockFn: () => T,
): Promise<{ ok: boolean; status: number; data: T }> {
  try {
    const res = await fetch(url);
    if (res.status === 404) {
      return { ok: true, status: 200, data: mockFn() };
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = mockFn();
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: true, status: 200, data: mockFn() };
  }
}

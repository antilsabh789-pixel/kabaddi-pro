import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'kabaddi_pro_salt').digest('hex');
}

// Helper: random integer in range [min, max]
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Indian kabaddi player names
const PLAYER_NAMES = [
  // Mumbai Warriors - Raiders focused
  'Ajay Thakur', 'Rishank Devadiga', 'Vishal Bhardwaj', 'Girish Ernak', 'Fazel Atrachali',
  // Delhi Eagles - Balanced
  'Joginder Narwal', 'Meraj Sheykh', 'Ravinder Pahal', 'Naveen Kumar', 'Chandran Ranjit',
  // Bengal Tigers - Defenders
  'Maninder Singh', 'Rohit Kumar', 'Amit Sheoran', 'Baldev Singh', 'Prapanjan',
  // Pune Raiders - All-rounders
  'Deepak Niwas Hooda', 'Sandeep Narwal', 'Rahul Chaudhari', 'Monu Goyat', 'Surender Nada',
  // Jaipur Kings - Raiders
  'Anup Kumar', 'Deepak Hooda', 'Abozar Mighani', 'Sultan Dange', 'Tushar Patil',
  // Chennai Strikers - Defenders
  'Surjeet Singh', 'Prashanth Rai', 'Maneet Singh', 'Hadi Tajik', 'Dong Geon Lee',
  // Hyderabad Bulls - Balanced
  'Siddharth Desai', 'Vikas Kandola', 'Kashiling Adake', 'Shabeer Bapu', 'Rakesh Narwal',
  // Kolkata Lions - All-rounders
  'Pardeep Narwal', 'Rohit Gulia', 'Vijay Malik', 'Nitin Tomar', 'Sachin Tanwar',
];

const TEAM_DATA = [
  { name: 'Mumbai Warriors', shortName: 'MW', color: '#DC2626', teamCode: 'KT2001' },
  { name: 'Delhi Eagles', shortName: 'DE', color: '#2563EB', teamCode: 'KT2002' },
  { name: 'Bengal Tigers', shortName: 'BT', color: '#EA580C', teamCode: 'KT2003' },
  { name: 'Pune Raiders', shortName: 'PR', color: '#16A34A', teamCode: 'KT2004' },
  { name: 'Jaipur Kings', shortName: 'JK', color: '#7C3AED', teamCode: 'KT2005' },
  { name: 'Chennai Strikers', shortName: 'CS', color: '#CA8A04', teamCode: 'KT2006' },
  { name: 'Hyderabad Bulls', shortName: 'HB', color: '#0D9488', teamCode: 'KT2007' },
  { name: 'Kolkata Lions', shortName: 'KL', color: '#7F1D1D', teamCode: 'KT2008' },
];

const GROUND_DATA = [
  {
    name: 'Sardar Vallabhbhai Patel Indoor Stadium',
    address: 'Worli, Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    surface: 'mat',
  },
  {
    name: 'Thyagaraj Sports Complex',
    address: 'New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    surface: 'synthetic',
  },
  {
    name: 'Shree Shiv Chhatrapati Sports Complex',
    address: 'Balewadi, Pune',
    city: 'Pune',
    state: 'Maharashtra',
    surface: 'mat',
  },
  {
    name: 'DOME@NSCI SVP Stadium',
    address: 'Worli, Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    surface: 'mat',
  },
];

// Position templates for variety
type PositionType = 'raider' | 'defender' | 'all-rounder';
const WEIGHT_CATEGORIES = ['Below 65kg', '65-75kg', '75-85kg', 'Above 85kg'];

function generateProfileStats(position: PositionType, matchCount: number) {
  const base = matchCount;
  let totalRaids = 0;
  let successfulRaids = 0;
  let totalTackles = 0;
  let successfulTackles = 0;
  let raidPoints = 0;
  let tacklePoints = 0;
  let bonusPoints = 0;
  let superTackles = 0;

  if (position === 'raider') {
    totalRaids = randInt(base * 5, base * 12);
    successfulRaids = Math.floor(totalRaids * (0.4 + Math.random() * 0.25));
    raidPoints = successfulRaids + randInt(0, Math.floor(successfulRaids * 0.3));
    bonusPoints = randInt(Math.floor(totalRaids * 0.05), Math.floor(totalRaids * 0.15));
    totalTackles = randInt(0, base * 2);
    successfulTackles = Math.floor(totalTackles * 0.4);
    tacklePoints = successfulTackles;
    superTackles = randInt(0, Math.floor(successfulTackles * 0.2));
  } else if (position === 'defender') {
    totalRaids = randInt(0, base * 2);
    successfulRaids = Math.floor(totalRaids * 0.3);
    raidPoints = successfulRaids;
    bonusPoints = randInt(0, Math.floor(totalRaids * 0.05));
    totalTackles = randInt(base * 5, base * 12);
    successfulTackles = Math.floor(totalTackles * (0.35 + Math.random() * 0.2));
    tacklePoints = successfulTackles;
    superTackles = randInt(Math.floor(successfulTackles * 0.1), Math.floor(successfulTackles * 0.3));
  } else {
    // all-rounder
    totalRaids = randInt(base * 3, base * 7);
    successfulRaids = Math.floor(totalRaids * (0.35 + Math.random() * 0.2));
    raidPoints = successfulRaids + randInt(0, Math.floor(successfulRaids * 0.2));
    bonusPoints = randInt(Math.floor(totalRaids * 0.03), Math.floor(totalRaids * 0.1));
    totalTackles = randInt(base * 3, base * 7);
    successfulTackles = Math.floor(totalTackles * (0.35 + Math.random() * 0.2));
    tacklePoints = successfulTackles;
    superTackles = randInt(0, Math.floor(successfulTackles * 0.2));
  }

  const totalPoints = raidPoints + tacklePoints + bonusPoints;

  return {
    totalRaids,
    successfulRaids,
    totalTackles,
    successfulTackles,
    bonusPoints,
    superTackles,
    totalMatches: matchCount,
    totalPoints,
    raidPoints,
    tacklePoints,
    // Tournament stats (subset of overall)
    tournamentMatches: Math.floor(matchCount * 0.6),
    tournamentTotalRaids: Math.floor(totalRaids * 0.6),
    tournamentSuccessfulRaids: Math.floor(successfulRaids * 0.6),
    tournamentTotalTackles: Math.floor(totalTackles * 0.6),
    tournamentSuccessfulTackles: Math.floor(successfulTackles * 0.6),
    tournamentRaidPoints: Math.floor(raidPoints * 0.6),
    tournamentTacklePoints: Math.floor(tacklePoints * 0.6),
    tournamentBonusPoints: Math.floor(bonusPoints * 0.6),
    tournamentSuperTackles: Math.floor(superTackles * 0.6),
    tournamentTotalPoints: Math.floor(totalPoints * 0.6),
    // Practice stats (the remainder)
    practiceMatches: matchCount - Math.floor(matchCount * 0.6),
    practiceTotalRaids: totalRaids - Math.floor(totalRaids * 0.6),
    practiceSuccessfulRaids: successfulRaids - Math.floor(successfulRaids * 0.6),
    practiceTotalTackles: totalTackles - Math.floor(totalTackles * 0.6),
    practiceSuccessfulTackles: successfulTackles - Math.floor(successfulTackles * 0.6),
    practiceRaidPoints: raidPoints - Math.floor(raidPoints * 0.6),
    practiceTacklePoints: tacklePoints - Math.floor(tacklePoints * 0.6),
    practiceBonusPoints: bonusPoints - Math.floor(bonusPoints * 0.6),
    practiceSuperTackles: superTackles - Math.floor(superTackles * 0.6),
    practiceTotalPoints: totalPoints - Math.floor(totalPoints * 0.6),
  };
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceReset = searchParams.get('reset') === 'true';

    // ── Idempotency check ────────────────────────────────────────
    const existingTeams = await db.team.count({ where: { teamCode: { startsWith: 'KT' } } });

    if (existingTeams > 0 && !forceReset) {
      return NextResponse.json({
        message: 'Database already seeded. Use ?reset=true to re-seed.',
        counts: { teams: existingTeams },
      });
    }

    // ── Force reset: clean up existing seed data ─────────────────
    if (forceReset && existingTeams > 0) {
      // Delete in correct order respecting foreign keys
      const seedTeams = await db.team.findMany({
        where: { teamCode: { startsWith: 'KT' } },
        select: { id: true },
      });
      const seedTeamIds = seedTeams.map((t) => t.id);

      // Delete match events for matches involving seed teams
      const seedMatches = await db.match.findMany({
        where: {
          OR: [
            { homeTeamId: { in: seedTeamIds } },
            { awayTeamId: { in: seedTeamIds } },
          ],
        },
        select: { id: true },
      });
      const seedMatchIds = seedMatches.map((m) => m.id);

      if (seedMatchIds.length > 0) {
        await db.matchEvent.deleteMany({ where: { matchId: { in: seedMatchIds } } });
        await db.matchScorer.deleteMany({ where: { matchId: { in: seedMatchIds } } });
      }

      // Delete tournament entries and matches for seed teams
      await db.tournamentEntry.deleteMany({ where: { teamId: { in: seedTeamIds } } });
      await db.match.deleteMany({
        where: {
          OR: [
            { homeTeamId: { in: seedTeamIds } },
            { awayTeamId: { in: seedTeamIds } },
          ],
        },
      });

      // Delete team members for seed teams
      await db.teamMember.deleteMany({ where: { teamId: { in: seedTeamIds } } });

      // Delete seed teams
      await db.team.deleteMany({ where: { id: { in: seedTeamIds } } });

      // Delete seed users (player codes starting with KP2)
      const seedUsers = await db.user.findMany({
        where: { playerCode: { startsWith: 'KP2' } },
        select: { id: true },
      });
      const seedUserIds = seedUsers.map((u) => u.id);

      if (seedUserIds.length > 0) {
        await db.playerProfile.deleteMany({ where: { userId: { in: seedUserIds } } });
        await db.user.deleteMany({ where: { id: { in: seedUserIds } } });
      }

      // Delete seed grounds
      await db.ground.deleteMany({
        where: {
          name: {
            in: GROUND_DATA.map((g) => g.name),
          },
        },
      });

      // Delete seed tournaments
      await db.tournament.deleteMany({
        where: { tournamentCode: 'TC3001' },
      });
    }

    const counts = {
      grounds: 0,
      teams: 0,
      users: 0,
      playerProfiles: 0,
      teamMembers: 0,
      tournaments: 0,
      tournamentEntries: 0,
      matches: 0,
      matchEvents: 0,
    };

    // ── 1. Create Grounds ────────────────────────────────────────
    const grounds = [];
    for (const g of GROUND_DATA) {
      const ground = await db.ground.create({ data: g });
      grounds.push(ground);
    }
    counts.grounds = grounds.length;

    // ── 2. Create Teams ──────────────────────────────────────────
    const teams = [];
    for (const t of TEAM_DATA) {
      const team = await db.team.create({ data: t });
      teams.push(team);
    }
    counts.teams = teams.length;

    // ── 3. Create Users + PlayerProfiles + TeamMembers ───────────
    const users: { id: string; teamId: string; position: PositionType }[] = [];
    let playerCodeNum = 2001;
    const usedJerseyNumbers = new Set<number>();

    for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
      const team = teams[teamIdx];
      const teamPlayerNames = PLAYER_NAMES.slice(teamIdx * 5, (teamIdx + 1) * 5);

      // Position distribution: 2 raiders, 2 defenders, 1 all-rounder
      const positionAssignments: PositionType[] = ['raider', 'raider', 'defender', 'defender', 'all-rounder'];

      for (let playerIdx = 0; playerIdx < teamPlayerNames.length; playerIdx++) {
        const name = teamPlayerNames[playerIdx];
        const playerCode = `KP${playerCodeNum++}`;
        const phone = `8${String(teamIdx * 5 + playerIdx + 1).padStart(9, '0')}`;
        const position = positionAssignments[playerIdx];
        const matchCount = randInt(8, 35);
        const jerseyNumber = (() => {
          let jn: number;
          do { jn = randInt(1, 99); } while (usedJerseyNumbers.has(jn));
          usedJerseyNumbers.add(jn);
          return jn;
        })();

        // Create user
        const user = await db.user.create({
          data: {
            phone,
            playerCode,
            name,
            password: hashPassword('demo123'),
            role: 'player',
            gender: 'boy',
            weight: WEIGHT_CATEGORIES[randInt(0, 3)],
          },
        });

        // Create player profile with stats
        const stats = generateProfileStats(position, matchCount);
        const rating = Math.min(
          100,
          Math.round(
            (stats.successfulRaids / Math.max(stats.totalRaids, 1)) * 40 +
              (stats.successfulTackles / Math.max(stats.totalTackles, 1)) * 40 +
              stats.totalPoints / Math.max(stats.totalMatches, 1) * 2
          )
        );

        await db.playerProfile.create({
          data: {
            userId: user.id,
            jerseyNumber,
            weightCategory: WEIGHT_CATEGORIES[randInt(0, 3)],
            position,
            overallRating: rating,
            ...stats,
          },
        });

        counts.playerProfiles++;

        // Create team membership - first player is captain
        await db.teamMember.create({
          data: {
            teamId: team.id,
            userId: user.id,
            isCaptain: playerIdx === 0,
          },
        });

        counts.teamMembers++;
        users.push({ id: user.id, teamId: team.id, position });
      }
    }
    counts.users = users.length;

    // ── 4. Create Tournament ─────────────────────────────────────
    const tournament = await db.tournament.create({
      data: {
        name: 'Pro Kabaddi League 2025',
        tournamentCode: 'TC3001',
        type: 'knockout',
        status: 'ongoing',
        gender: 'boys',
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-03-30'),
        venue: 'Multiple Venues, India',
      },
    });
    counts.tournaments = 1;

    // Add all 8 teams to the tournament
    for (const team of teams) {
      const played = randInt(2, 6);
      const won = randInt(0, played);
      const lost = played - won;
      await db.tournamentEntry.create({
        data: {
          tournamentId: tournament.id,
          teamId: team.id,
          played,
          won,
          lost,
          drawn: 0,
          scoreDiff: randInt(-20, 30),
          points: won * 3,
        },
      });
    }
    counts.tournamentEntries = teams.length;

    // ── 5. Create Matches ────────────────────────────────────────

    // Match 1: Completed (Mumbai Warriors vs Delhi Eagles) — Mumbai won
    const match1 = await db.match.create({
      data: {
        tournamentId: tournament.id,
        homeTeamId: teams[0].id,
        awayTeamId: teams[1].id,
        homeScore: 38,
        awayScore: 32,
        half: 2,
        halfDuration: 20,
        playersPerSide: 7,
        status: 'completed',
        gender: 'boys',
        groundId: grounds[0].id,
        venue: grounds[0].name,
        startedAt: new Date('2025-01-20T18:00:00Z'),
        completedAt: new Date('2025-01-20T19:30:00Z'),
        motmUserId: users.find((u) => u.teamId === teams[0].id && u.position === 'raider')?.id || null,
      },
    });

    // Events for match 1
    const match1HomePlayers = users.filter((u) => u.teamId === teams[0].id);
    const match1AwayPlayers = users.filter((u) => u.teamId === teams[1].id);

    const match1Events = [
      // Half 1
      { matchId: match1.id, teamId: teams[0].id, playerId: match1HomePlayers[0].id, eventType: 'raid_point', value: 1, half: 1 },
      { matchId: match1.id, teamId: teams[0].id, playerId: match1HomePlayers[1].id, eventType: 'raid_point', value: 2, half: 1 },
      { matchId: match1.id, teamId: teams[1].id, playerId: match1AwayPlayers[2].id, eventType: 'tackle', value: 1, half: 1 },
      { matchId: match1.id, teamId: teams[1].id, playerId: match1AwayPlayers[0].id, eventType: 'raid_point', value: 1, half: 1 },
      { matchId: match1.id, teamId: teams[0].id, playerId: match1HomePlayers[2].id, eventType: 'tackle', value: 1, half: 1 },
      { matchId: match1.id, teamId: teams[0].id, playerId: match1HomePlayers[0].id, eventType: 'bonus_point', value: 1, half: 1 },
      { matchId: match1.id, teamId: teams[1].id, playerId: match1AwayPlayers[1].id, eventType: 'raid_point', value: 1, half: 1 },
      { matchId: match1.id, teamId: teams[0].id, playerId: match1HomePlayers[4].id, eventType: 'raid_point', value: 2, half: 1 },
      { matchId: match1.id, teamId: teams[1].id, playerId: match1AwayPlayers[3].id, eventType: 'tackle', value: 1, half: 1 },
      { matchId: match1.id, teamId: teams[1].id, playerId: match1AwayPlayers[0].id, eventType: 'bonus_point', value: 1, half: 1 },
      // Half 2
      { matchId: match1.id, teamId: teams[0].id, playerId: match1HomePlayers[0].id, eventType: 'raid_point', value: 2, half: 2 },
      { matchId: match1.id, teamId: teams[1].id, playerId: match1AwayPlayers[0].id, eventType: 'raid_point', value: 1, half: 2 },
      { matchId: match1.id, teamId: teams[0].id, playerId: match1HomePlayers[2].id, eventType: 'tackle', value: 1, half: 2 },
      { matchId: match1.id, teamId: teams[0].id, playerId: match1HomePlayers[1].id, eventType: 'raid_point', value: 1, half: 2 },
      { matchId: match1.id, teamId: teams[1].id, playerId: match1AwayPlayers[2].id, eventType: 'tackle', value: 2, half: 2 },
      { matchId: match1.id, teamId: teams[0].id, playerId: match1HomePlayers[0].id, eventType: 'raid_point', value: 1, half: 2 },
      { matchId: match1.id, teamId: teams[0].id, playerId: match1HomePlayers[4].id, eventType: 'raid_point', value: 2, half: 2 },
      { matchId: match1.id, teamId: teams[0].id, playerId: match1HomePlayers[3].id, eventType: 'all_out', value: 2, half: 2 },
    ];

    for (const event of match1Events) {
      await db.matchEvent.create({ data: event });
      counts.matchEvents++;
    }
    counts.matches++;

    // Match 2: Completed (Bengal Tigers vs Pune Raiders) — Pune won
    const match2 = await db.match.create({
      data: {
        tournamentId: tournament.id,
        homeTeamId: teams[2].id,
        awayTeamId: teams[3].id,
        homeScore: 28,
        awayScore: 35,
        half: 2,
        halfDuration: 20,
        playersPerSide: 7,
        status: 'completed',
        gender: 'boys',
        groundId: grounds[1].id,
        venue: grounds[1].name,
        startedAt: new Date('2025-01-22T18:00:00Z'),
        completedAt: new Date('2025-01-22T19:30:00Z'),
        motmUserId: users.find((u) => u.teamId === teams[3].id && u.position === 'all-rounder')?.id || null,
      },
    });

    const match2HomePlayers = users.filter((u) => u.teamId === teams[2].id);
    const match2AwayPlayers = users.filter((u) => u.teamId === teams[3].id);

    const match2Events = [
      { matchId: match2.id, teamId: teams[2].id, playerId: match2HomePlayers[0].id, eventType: 'raid_point', value: 1, half: 1 },
      { matchId: match2.id, teamId: teams[3].id, playerId: match2AwayPlayers[0].id, eventType: 'raid_point', value: 2, half: 1 },
      { matchId: match2.id, teamId: teams[2].id, playerId: match2HomePlayers[2].id, eventType: 'tackle', value: 1, half: 1 },
      { matchId: match2.id, teamId: teams[3].id, playerId: match2AwayPlayers[4].id, eventType: 'raid_point', value: 1, half: 1 },
      { matchId: match2.id, teamId: teams[3].id, playerId: match2AwayPlayers[2].id, eventType: 'tackle', value: 1, half: 1 },
      { matchId: match2.id, teamId: teams[2].id, playerId: match2HomePlayers[1].id, eventType: 'raid_point', value: 1, half: 1 },
      { matchId: match2.id, teamId: teams[3].id, playerId: match2AwayPlayers[0].id, eventType: 'bonus_point', value: 1, half: 1 },
      // Half 2
      { matchId: match2.id, teamId: teams[3].id, playerId: match2AwayPlayers[4].id, eventType: 'raid_point', value: 2, half: 2 },
      { matchId: match2.id, teamId: teams[2].id, playerId: match2HomePlayers[0].id, eventType: 'raid_point', value: 1, half: 2 },
      { matchId: match2.id, teamId: teams[3].id, playerId: match2AwayPlayers[1].id, eventType: 'raid_point', value: 1, half: 2 },
      { matchId: match2.id, teamId: teams[3].id, playerId: match2AwayPlayers[3].id, eventType: 'tackle', value: 1, half: 2 },
      { matchId: match2.id, teamId: teams[3].id, playerId: match2AwayPlayers[4].id, eventType: 'raid_point', value: 2, half: 2 },
      { matchId: match2.id, teamId: teams[3].id, playerId: match2AwayPlayers[2].id, eventType: 'all_out', value: 2, half: 2 },
      { matchId: match2.id, teamId: teams[2].id, playerId: match2HomePlayers[3].id, eventType: 'tackle', value: 1, half: 2 },
    ];

    for (const event of match2Events) {
      await db.matchEvent.create({ data: event });
      counts.matchEvents++;
    }
    counts.matches++;

    // Match 3: Live (Jaipur Kings vs Chennai Strikers)
    const match3 = await db.match.create({
      data: {
        tournamentId: tournament.id,
        homeTeamId: teams[4].id,
        awayTeamId: teams[5].id,
        homeScore: 15,
        awayScore: 12,
        half: 1,
        halfDuration: 20,
        playersPerSide: 7,
        status: 'live',
        gender: 'boys',
        groundId: grounds[2].id,
        venue: grounds[2].name,
        startedAt: new Date(),
      },
    });

    const match3HomePlayers = users.filter((u) => u.teamId === teams[4].id);
    const match3AwayPlayers = users.filter((u) => u.teamId === teams[5].id);

    const match3Events = [
      { matchId: match3.id, teamId: teams[4].id, playerId: match3HomePlayers[0].id, eventType: 'raid_point', value: 1, half: 1 },
      { matchId: match3.id, teamId: teams[5].id, playerId: match3AwayPlayers[2].id, eventType: 'tackle', value: 1, half: 1 },
      { matchId: match3.id, teamId: teams[5].id, playerId: match3AwayPlayers[0].id, eventType: 'raid_point', value: 1, half: 1 },
      { matchId: match3.id, teamId: teams[4].id, playerId: match3HomePlayers[1].id, eventType: 'raid_point', value: 2, half: 1 },
      { matchId: match3.id, teamId: teams[5].id, playerId: match3AwayPlayers[3].id, eventType: 'tackle', value: 1, half: 1 },
      { matchId: match3.id, teamId: teams[4].id, playerId: match3HomePlayers[0].id, eventType: 'bonus_point', value: 1, half: 1 },
      { matchId: match3.id, teamId: teams[5].id, playerId: match3AwayPlayers[1].id, eventType: 'raid_point', value: 1, half: 1 },
      { matchId: match3.id, teamId: teams[4].id, playerId: match3HomePlayers[2].id, eventType: 'tackle', value: 1, half: 1 },
      { matchId: match3.id, teamId: teams[4].id, playerId: match3HomePlayers[4].id, eventType: 'raid_point', value: 1, half: 1 },
      { matchId: match3.id, teamId: teams[5].id, playerId: match3AwayPlayers[0].id, eventType: 'raid_point', value: 2, half: 1 },
    ];

    for (const event of match3Events) {
      await db.matchEvent.create({ data: event });
      counts.matchEvents++;
    }
    counts.matches++;

    // Match 4: Upcoming (Hyderabad Bulls vs Kolkata Lions)
    await db.match.create({
      data: {
        tournamentId: tournament.id,
        homeTeamId: teams[6].id,
        awayTeamId: teams[7].id,
        half: 1,
        halfDuration: 20,
        playersPerSide: 7,
        status: 'upcoming',
        gender: 'boys',
        groundId: grounds[3].id,
        venue: grounds[3].name,
      },
    });
    counts.matches++;

    // Match 5: Upcoming (Mumbai Warriors vs Bengal Tigers)
    await db.match.create({
      data: {
        tournamentId: tournament.id,
        homeTeamId: teams[0].id,
        awayTeamId: teams[2].id,
        half: 1,
        halfDuration: 20,
        playersPerSide: 7,
        status: 'upcoming',
        gender: 'boys',
        groundId: grounds[0].id,
        venue: grounds[0].name,
      },
    });
    counts.matches++;

    return NextResponse.json({
      message: 'Database seeded successfully!',
      counts,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed database', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

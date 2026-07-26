import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { db } from '../lib/db';

const router = Router();

// ── Seasons ───────────────────────────────────────────────────────────────────

router.get('/seasons', async (req, res) => {
  try {
    const status = (req.query['status'] as string) || '';
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const seasons = await db.season.findMany({ where, include: { seasonTeams: { include: { team: { select: { id: true, name: true, shortName: true, logo: true, color: true } } }, orderBy: { rank: 'asc' } }, _count: { select: { seasonMatches: true, sponsors: true } } }, orderBy: { createdAt: 'desc' } });
    return res.json({ seasons });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/seasons', async (req, res) => {
  try {
    const { name, year, startDate, endDate, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const season = await db.season.create({ data: { name, year: year || new Date().getFullYear(), startDate: startDate ? new Date(startDate) : new Date(), endDate: endDate ? new Date(endDate) : null, description: description || null, status: 'upcoming' } });
    return res.json({ season });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/seasons/:id', async (req, res) => {
  try {
    const season = await db.season.findUnique({
      where: { id: req.params['id'] },
      include: { seasonTeams: { include: { team: { select: { id: true, name: true, shortName: true, logo: true, color: true } } }, orderBy: { rank: 'asc' } }, seasonMatches: { include: { match: { include: { homeTeam: { select: { id: true, name: true, shortName: true, color: true } }, awayTeam: { select: { id: true, name: true, shortName: true, color: true } } } } } }, sponsors: true },
    });
    if (!season) return res.status(404).json({ error: 'Season not found' });
    return res.json({ season });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/seasons/:id/add-team', async (req, res) => {
  try {
    const { id: seasonId } = req.params;
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    const [season, team] = await Promise.all([
      db.season.findUnique({ where: { id: seasonId } }),
      db.team.findUnique({ where: { id: teamId } }),
    ]);
    if (!season) return res.status(404).json({ error: 'Season not found' });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const existing = await db.seasonTeam.findUnique({ where: { seasonId_teamId: { seasonId, teamId } } });
    if (existing) return res.status(409).json({ error: 'Team already in season', seasonTeam: existing });

    const seasonTeam = await db.seasonTeam.create({ data: { seasonId, teamId, wins: 0, losses: 0, draws: 0, points: 0, rank: 0 } });
    return res.json({ seasonTeam });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Sponsors ──────────────────────────────────────────────────────────────────

router.get('/sponsors', async (req, res) => {
  try {
    const seasonId = req.query['seasonId'] as string;
    const where: Record<string, unknown> = {};
    if (seasonId) where.seasonId = seasonId;
    const sponsors = await db.sponsor.findMany({ where, orderBy: { createdAt: 'desc' } });
    return res.json({ sponsors });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/sponsors', async (req, res) => {
  try {
    const { name, logo, website, seasonId } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const sponsor = await db.sponsor.create({ data: { name, logo: logo || null, website: website || null, seasonId: seasonId || null } });
    return res.json({ sponsor });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── AI Insights ───────────────────────────────────────────────────────────────

router.get('/ai-insights', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const profile = await db.playerProfile.findUnique({ where: { userId } });
    if (!profile) return res.json({ insights: [], profile: null });

    const insights = [];

    if (profile.totalRaids > 0) {
      const raidRate = Math.round((profile.successfulRaids / profile.totalRaids) * 100);
      if (raidRate < 40) insights.push({ type: 'improvement', title: 'Raid Accuracy', message: `Your raid success rate is ${raidRate}%. Focus on touch-point raids to improve.` });
      else if (raidRate >= 60) insights.push({ type: 'strength', title: 'Strong Raider', message: `Excellent raid success rate of ${raidRate}%! Keep up the aggressive play.` });
    }

    if (profile.totalTackles > 0) {
      const tackleRate = Math.round((profile.successfulTackles / profile.totalTackles) * 100);
      if (tackleRate >= 55) insights.push({ type: 'strength', title: 'Elite Defender', message: `Your tackle success rate of ${tackleRate}% is exceptional.` });
    }

    if (profile.totalMatches >= 5) {
      insights.push({ type: 'milestone', title: 'Experienced Player', message: `You've played ${profile.totalMatches} matches. Keep building your experience!` });
    }

    return res.json({ insights, profile });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Quiz ──────────────────────────────────────────────────────────────────────

router.get('/quiz', async (req, res) => {
  try {
    const questions = [
      { id: '1', question: 'What is the maximum time for a raid in kabaddi?', options: ['30 seconds', '45 seconds', '60 seconds', '20 seconds'], answer: 0 },
      { id: '2', question: 'How many players are on each side in kabaddi?', options: ['5', '6', '7', '8'], answer: 2 },
      { id: '3', question: 'What is an "all-out" in kabaddi?', options: ['A team wins', 'All opponents are out', 'Time expires', 'A bonus point'], answer: 1 },
      { id: '4', question: 'What word must a raider chant during a raid?', options: ['Kabaddi', 'Attack', 'Touch', 'Go'], answer: 0 },
    ];
    return res.json({ questions });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/quiz', async (req, res) => {
  try {
    const { userId, answers, score } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const attempt = await db.quizAttempt.create({ data: { userId, category: 'rules', score: score || 0, totalQuestions: 4 } });
    return res.json({ attempt });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Export ────────────────────────────────────────────────────────────────────

router.get('/export', async (req, res) => {
  try {
    const type = (req.query['type'] as string) || 'players';
    const format = (req.query['format'] as string) || 'json';

    let data: unknown;
    if (type === 'players') {
      data = await db.user.findMany({ select: { id: true, name: true, playerCode: true, gender: true, createdAt: true }, take: 1000 });
    } else if (type === 'matches') {
      data = await db.match.findMany({ include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } }, take: 1000 });
    } else if (type === 'tournaments') {
      data = await db.tournament.findMany({ take: 100 });
    } else {
      data = [];
    }

    if (format === 'csv') {
      const arr = Array.isArray(data) ? data : [data];
      if (arr.length === 0) return res.send('');
      const headers = Object.keys(arr[0] as object);
      const csv = [headers.join(','), ...arr.map((row) => headers.map((h) => JSON.stringify((row as any)[h] ?? '')).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${type}.csv`);
      return res.send(csv);
    }

    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Scorecard PDF ─────────────────────────────────────────────────────────────
//
// GET /api/scorecard-pdf?matchId=X
//
// Returns a JSON object: { scorecard: {...} } that matches the frontend's
// `Scorecard` TypeScript interface (see ScorecardPDFScreen.tsx). The frontend
// previously called this endpoint expecting JSON, but the old handler
// returned a tiny HTML stub — which caused apiBase.ts's fetch wrapper to
// throw "Unexpected response from server" (content-type was text/html, not
// application/json) → the scorecard screen always errored out with
// "Unable to Load Scorecard". This rewrite builds the full scorecard payload
// from the match's stored events + team rosters so the screen actually
// renders: half-by-half scores, events summary, top performers, and all
// match metadata.

router.get('/scorecard-pdf', async (req, res) => {
  try {
    const matchId = req.query['matchId'] as string;
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, color: true, logo: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, color: true, logo: true } },
        tournament: { select: { id: true, name: true } },
        events: { orderBy: { timestamp: 'asc' } },
      },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    // Pull both team rosters in parallel so we can resolve player names for
    // the top-performers list. Phone-only (unregistered) players fall back
    // to "Player XXXX" (last 4 digits of phone). Wrapped in try/catch so a
    // missing relation doesn't take down the whole scorecard.
    const safeRoster = async (teamId: string) => {
      try {
        const members = await db.teamMember.findMany({
          where: { teamId },
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        });
        const map = new Map<string, string>();
        for (const m of members) {
          map.set(m.user.id, m.user.name || 'Player');
        }
        return map;
      } catch {
        return new Map<string, string>();
      }
    };

    const [homeNameMap, awayNameMap] = await Promise.all([
      safeRoster(match.homeTeamId),
      safeRoster(match.awayTeamId),
    ]);

    // Merge both maps for top-performer lookup. If a player appears on both
    // teams (rare but possible in practice matches), prefer the team that
    // matches their event's teamId.
    const allNameMaps = new Map<string, { name: string; teamName: string }>();
    for (const [uid, name] of homeNameMap) {
      allNameMaps.set(uid, { name, teamName: match.homeTeam.name });
    }
    for (const [uid, name] of awayNameMap) {
      if (!allNameMaps.has(uid)) {
        allNameMaps.set(uid, { name, teamName: match.awayTeam.name });
      }
    }

    // ─── Compute events summary + per-player points ────────────────
    // For point-scoring events (raid_point, bonus_point, tackle_point,
    // super_tackle, super_raid, all_out) we sum `value` (which is the points
    // scored). For non-scoring events (empty_raid, do_or_die_raid, self_out,
    // cards, timeout, substitution) we count the events. This matches what
    // a kabaddi fan expects to see on a scorecard — "Raid Points: 12" means
    // 12 raid points were scored, not that 12 raids happened.
    const SCORING_EVENTS = new Set([
      'raid_point', 'bonus_point', 'tackle_point',
      'super_tackle', 'super_raid', 'all_out',
    ]);

    const eventsSummary: Record<string, { home: number; away: number }> = {};
    const playerPoints: Record<string, { points: number; teamId: string; phone?: string | null }> = {};

    for (const evt of match.events) {
      const isHome = evt.teamId === match.homeTeamId;
      const side = isHome ? 'home' : 'away';

      if (!eventsSummary[evt.eventType]) {
        eventsSummary[evt.eventType] = { home: 0, away: 0 };
      }
      const val = SCORING_EVENTS.has(evt.eventType) ? (evt.value || 0) : 1;
      eventsSummary[evt.eventType][side] += val;

      // Aggregate points per player for top-performers list
      if (SCORING_EVENTS.has(evt.eventType)) {
        const key = evt.playerId || (evt.playerPhone ? `phone_${evt.playerPhone}` : null);
        if (key) {
          if (!playerPoints[key]) {
            playerPoints[key] = { points: 0, teamId: evt.teamId, phone: evt.playerPhone };
          }
          playerPoints[key].points += (evt.value || 0);
        }
      }
    }

    // ─── Compute half-by-half scores ───────────────────────────────
    // Sum event values per half per team. Falls back to 0 if events array
    // is empty (e.g. an upcoming match someone clicked into early). The
    // total `homeScore`/`awayScore` columns are taken from the stored match
    // row (which is what the live scoreboard shows), not recomputed.
    let homeFirstHalf = 0;
    let homeSecondHalf = 0;
    let awayFirstHalf = 0;
    let awaySecondHalf = 0;
    for (const evt of match.events) {
      if (!SCORING_EVENTS.has(evt.eventType)) continue;
      const val = evt.value || 0;
      const isHome = evt.teamId === match.homeTeamId;
      if (evt.half === 1) {
        if (isHome) homeFirstHalf += val; else awayFirstHalf += val;
      } else if (evt.half === 2) {
        if (isHome) homeSecondHalf += val; else awaySecondHalf += val;
      }
    }

    // ─── Build top performers list ─────────────────────────────────
    const topPerformers = Object.entries(playerPoints)
      .map(([key, info]) => {
        let name: string;
        let teamName: string;
        if (key.startsWith('phone_')) {
          // Unregistered player — show last 4 digits of phone
          const phone = info.phone || key.slice('phone_'.length);
          name = `Player ${String(phone).slice(-4)}`;
          teamName = info.teamId === match.homeTeamId ? match.homeTeam.name : match.awayTeam.name;
        } else {
          const lookup = allNameMaps.get(key);
          name = lookup?.name || `Player ${key.slice(-4)}`;
          teamName = lookup?.teamName || (info.teamId === match.homeTeamId ? match.homeTeam.name : match.awayTeam.name);
        }
        return { name, points: info.points, teamName };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    // ─── Build the scorecard payload ───────────────────────────────
    const scorecard = {
      matchId: match.id,
      date: match.startedAt
        ? new Date(match.startedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : new Date(match.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      venue: match.venue || 'TBD',
      tournament: match.tournament?.name || null,
      gender: match.gender || null,
      weightCategory: match.weightCategory || null,
      status: match.status,
      isPractice: match.isPractice,
      halfDuration: match.halfDuration || 20,
      playersPerSide: match.playersPerSide || 7,
      homeTeam: {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        shortName: match.homeTeam.shortName || null,
        color: match.homeTeam.color || null,
        logo: match.homeTeam.logo || null,
        score: match.homeScore,
        firstHalfScore: homeFirstHalf,
        secondHalfScore: homeSecondHalf,
      },
      awayTeam: {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        shortName: match.awayTeam.shortName || null,
        color: match.awayTeam.color || null,
        logo: match.awayTeam.logo || null,
        score: match.awayScore,
        firstHalfScore: awayFirstHalf,
        secondHalfScore: awaySecondHalf,
      },
      eventsSummary,
      topPerformers,
      totalEvents: match.events.length,
    };

    return res.json({ scorecard });
  } catch (error) {
    console.error('Scorecard fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Upload ────────────────────────────────────────────────────────────────────

/**
 * POST /api/upload
 *
 * Accepts a JSON body: { fileData, fileName, fileType, userId }
 * - fileData: a base64 data URL (e.g. "data:image/jpeg;base64,...")
 * - userId: the user uploading the avatar
 *
 * Stores the data URL directly in the user's `avatar` field in the database.
 * This approach:
 *   - Doesn't require a file system (works on ephemeral containers like Railway)
 *   - Survives restarts/redeploys
 *   - Works on all devices (Vercel, Railway, Play Store WebView)
 *
 * Returns: { url: "<data URL>" }
 */
router.post('/upload', async (req, res) => {
  try {
    const { fileData, fileName, fileType, userId } = req.body;

    if (!fileData || typeof fileData !== 'string') {
      return res.status(400).json({ error: 'fileData is required' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Validate that fileData is a base64 data URL
    const match = fileData.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!match) {
      return res.status(400).json({ error: 'fileData must be a base64 data URL' });
    }

    // Limit size to ~2MB (base64 encoded = ~2.67MB). Avatars don't need to be huge.
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 2MB)' });
    }

    // Store the data URL directly in the user's avatar field
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { avatar: fileData },
      select: { id: true, avatar: true },
    });

    return res.json({ url: fileData, user: updatedUser });
  } catch (error: any) {
    console.error('Upload error:', error);
    // Surface the actual error message so the frontend can show a helpful toast
    const message = error?.message || 'Unknown error';
    return res.status(500).json({
      error: `Failed to upload file: ${message}`,
      // Include the error code so the frontend can handle specific cases
      code: error?.code || 'UPLOAD_FAILED',
    });
  }
});

// Serve uploaded files (kept for backward compatibility, but avatars are now
// stored as data URLs in the database, so this route is rarely needed)
router.get('/uploads/avatars/:filename', (req, res) => {
  const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
  const filePath = path.join(uploadDir, req.params['filename']);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  return res.status(404).json({ error: 'File not found' });
});

router.get('/uploads/teams/:filename', (req, res) => {
  const uploadDir = path.join(process.cwd(), 'uploads', 'teams');
  const filePath = path.join(uploadDir, req.params['filename']);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  return res.status(404).json({ error: 'File not found' });
});

// ── Seed ──────────────────────────────────────────────────────────────────────

router.post('/seed', async (req, res) => {
  if (process.env['NODE_ENV'] === 'production') return res.status(403).json({ error: 'Not allowed in production' });
  return res.json({ message: 'Seed endpoint available in development' });
});

export default router;

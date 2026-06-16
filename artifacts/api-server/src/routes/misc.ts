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
    const season = await db.season.create({ data: { name, year: year || new Date().getFullYear(), startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, description: description || null, status: 'upcoming' } });
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

router.get('/scorecard-pdf', async (req, res) => {
  try {
    const matchId = req.query['matchId'] as string;
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true, events: { orderBy: { createdAt: 'asc' } }, scorers: { include: { user: { select: { id: true, name: true } } } } },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const html = `<!DOCTYPE html><html><head><title>Scorecard - ${match.homeTeam.name} vs ${match.awayTeam.name}</title><style>body{font-family:sans-serif;padding:20px}h1{color:#DC2626}.score{font-size:36px;font-weight:bold;text-align:center}</style></head><body><h1>Kabaddi Pro Match Scorecard</h1><p>${match.homeTeam.name} vs ${match.awayTeam.name}</p><div class="score">${match.homeScore} - ${match.awayScore}</div><p>Status: ${match.status}</p></body></html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Upload ────────────────────────────────────────────────────────────────────

router.post('/upload', async (req, res) => {
  try {
    return res.json({ message: 'File upload endpoint - configure storage provider', url: null });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve uploaded files if any exist
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

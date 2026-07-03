import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

async function generateTeamCode(): Promise<string> {
  const last = await db.team.findFirst({ where: { teamCode: { not: null } }, orderBy: { teamCode: 'desc' }, select: { teamCode: true } });
  let nextNum = 2001;
  if (last?.teamCode) { const m = last.teamCode.match(/KT(\d+)/); if (m) nextNum = parseInt(m[1]) + 1; }
  return `KT${nextNum}`;
}

function generateShortName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 3) return (words[0].charAt(0) + words[1].charAt(0) + words[2].charAt(0)).toUpperCase();
  if (words.length === 2) return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

/**
 * Verify that the given userId is the captain of the team.
 * Returns true if yes, false otherwise. Used for captain-only operations.
 */
async function isCaptain(teamId: string, userId: string): Promise<boolean> {
  const member = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { isCaptain: true },
  });
  return !!member?.isCaptain;
}

/**
 * GET /api/teams
 * Returns teams based on the filter:
 *   - filter=my (DEFAULT): teams where the user is a member
 *   - filter=search: teams whose name or teamCode matches the search query
 *
 * IMPORTANT: There is NO "all" filter anymore. We never return every team in the
 * database. Users see only teams they're in, or teams they explicitly search for
 * by name/code. This protects team privacy and prevents scraping.
 */
router.get('/teams', async (req, res) => {
  try {
    const search = ((req.query['search'] as string) || '').trim();
    const userId = (req.query['userId'] as string) || '';
    const filter = (req.query['filter'] as string) || 'my';
    const limit = parseInt((req.query['limit'] as string) || '20');

    // Determine the effective filter:
    // - If user explicitly searches, treat as 'search' filter
    // - Otherwise default to 'my' (user's own teams)
    const effectiveFilter = search ? 'search' : (filter === 'search' ? 'search' : 'my');

    const where: Record<string, unknown> = {};

    if (effectiveFilter === 'my') {
      // Only return teams the user is a member of
      if (!userId) return res.json({ teams: [] });
      where.members = { some: { userId } };
    } else {
      // Search mode: require a non-empty search query
      if (!search) return res.json({ teams: [] });
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { teamCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const teams = await db.team.findMany({
      where,
      take: limit,
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatar: true, profile: true } } },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ teams });
  } catch (error) {
    console.error('Teams list error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/teams', async (req, res) => {
  try {
    const { name, color, logo, captainId, shortName } = req.body;
    if (!name || !captainId) return res.status(400).json({ error: 'name and captainId are required' });

    const teamCode = await generateTeamCode();
    const team = await db.team.create({
      data: { name, color: color || '#DC2626', logo: logo || null, shortName: shortName || generateShortName(name), teamCode },
    });
    await db.teamMember.create({ data: { teamId: team.id, userId: captainId, isCaptain: true } });
    return res.json({ team });
  } catch (error) {
    console.error('Team create error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/teams/search', async (req, res) => {
  try {
    // Accept both 'q' and 'teamCode' query params for backward compat
    // (QuickScoreTab uses ?teamCode=KT2001, other callers use ?q=...)
    const q = ((req.query['q'] as string) || (req.query['teamCode'] as string) || '').trim();
    const limit = parseInt((req.query['limit'] as string) || '10');
    if (!q) return res.json({ teams: [] });
    const teams = await db.team.findMany({
      where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { teamCode: { contains: q, mode: 'insensitive' } }] },
      take: limit,
      include: { _count: { select: { members: true } } },
    });
    return res.json({ teams: teams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName, color: t.color, teamCode: t.teamCode, memberCount: t._count.members })) });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/teams/compare', async (req, res) => {
  try {
    const teamId1 = req.query['teamId1'] as string;
    const teamId2 = req.query['teamId2'] as string;
    if (!teamId1 || !teamId2) return res.status(400).json({ error: 'teamId1 and teamId2 are required' });

    const [t1, t2] = await Promise.all([
      db.team.findUnique({ where: { id: teamId1 }, include: { members: { include: { user: { include: { profile: true } } } } } }),
      db.team.findUnique({ where: { id: teamId2 }, include: { members: { include: { user: { include: { profile: true } } } } } }),
    ]);
    if (!t1 || !t2) return res.status(404).json({ error: 'One or both teams not found' });
    return res.json({ teams: [t1, t2] });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/teams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const team = await db.team.findUnique({ where: { id }, include: { members: { include: { user: { include: { profile: true } } } } } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const homeMatches = await db.match.findMany({ where: { homeTeamId: id, status: 'completed' }, select: { homeScore: true, awayScore: true } });
    const awayMatches = await db.match.findMany({ where: { awayTeamId: id, status: 'completed' }, select: { homeScore: true, awayScore: true } });

    let wins = 0, losses = 0, totalPoints = 0;
    for (const m of homeMatches) { totalPoints += m.homeScore; if (m.homeScore > m.awayScore) wins++; else if (m.homeScore < m.awayScore) losses++; }
    for (const m of awayMatches) { totalPoints += m.awayScore; if (m.awayScore > m.homeScore) wins++; else if (m.awayScore < m.homeScore) losses++; }

    const recentMatches = await db.match.findMany({
      where: { OR: [{ homeTeamId: id }, { awayTeamId: id }], status: 'completed' },
      include: { homeTeam: { select: { id: true, name: true, shortName: true, color: true } }, awayTeam: { select: { id: true, name: true, shortName: true, color: true } } },
      orderBy: { completedAt: 'desc' }, take: 5,
    });

    return res.json({ team, stats: { wins, losses, draws: 0, totalMatches: wins + losses, totalPoints }, recentMatches });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/teams/:id
 *
 * Captain-only endpoint for managing a team. Supports 3 modes (checked in order):
 *
 *   1. Member management (when addMemberId / removeMemberId / captainId is in body):
 *      - addMemberId: add a user to the team as a regular member
 *      - removeMemberId: remove a member from the team (captain can remove anyone;
 *        a member can remove themselves = "leave team")
 *      - captainId: transfer captaincy to another existing member (current captain
 *        becomes a regular member)
 *
 *   2. Team info edit (when name / logo / color / shortName is in body):
 *      - Captain can edit the team's name, logo, color, or shortName
 *
 * The `captainUserId` field in the body is REQUIRED for all operations — the
 * backend verifies this user is the captain before applying any change.
 */
router.patch('/teams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      captainUserId,
      addMemberId,
      removeMemberId,
      captainId,
      name,
      logo,
      color,
      shortName,
    } = req.body;

    if (!captainUserId) {
      return res.status(400).json({ error: 'captainUserId is required' });
    }

    // Special case: a member removing THEMSELF is always allowed (it's "leave team")
    const isSelfRemove = removeMemberId && removeMemberId === captainUserId;

    // For all other operations, verify the requester is the captain
    if (!isSelfRemove) {
      const captainCheck = await isCaptain(id, captainUserId);
      if (!captainCheck) {
        return res.status(403).json({ error: 'Only the team captain can perform this action' });
      }
    }

    // ─── Mode 1: Member management ─────────────────────────────
    if (addMemberId) {
      // Check if already a member
      const existing = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId: id, userId: addMemberId } },
      });
      if (existing) {
        return res.status(409).json({ error: 'User is already a member of this team' });
      }
      await db.teamMember.create({
        data: { teamId: id, userId: addMemberId, isCaptain: false },
      });
      const updated = await db.team.findUnique({
        where: { id },
        include: { members: { include: { user: { select: { id: true, name: true, avatar: true, profile: true } } } } },
      });
      return res.json({ team: updated });
    }

    if (removeMemberId) {
      // Prevent captain from removing themselves via this endpoint (use leave / transfer-captain first)
      const targetMember = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId: id, userId: removeMemberId } },
      });
      if (!targetMember) {
        return res.status(404).json({ error: 'Member not found in this team' });
      }
      if (targetMember.isCaptain && !isSelfRemove) {
        return res.status(400).json({
          error: 'Cannot remove the captain. Transfer captaincy to another member first, then remove.',
        });
      }
      await db.teamMember.delete({
        where: { id: targetMember.id },
      });
      const updated = await db.team.findUnique({
        where: { id },
        include: { members: { include: { user: { select: { id: true, name: true, avatar: true, profile: true } } } } },
      });
      return res.json({ team: updated });
    }

    if (captainId) {
      // Transfer captaincy: current captain becomes regular member, target becomes captain
      const targetMember = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId: id, userId: captainId } },
      });
      if (!targetMember) {
        return res.status(404).json({ error: 'Target user is not a member of this team' });
      }
      if (targetMember.isCaptain) {
        return res.status(400).json({ error: 'User is already the captain' });
      }
      // Demote all existing captains (should be just one) and promote the target
      await db.teamMember.updateMany({
        where: { teamId: id, isCaptain: true },
        data: { isCaptain: false },
      });
      await db.teamMember.update({
        where: { id: targetMember.id },
        data: { isCaptain: true },
      });
      const updated = await db.team.findUnique({
        where: { id },
        include: { members: { include: { user: { select: { id: true, name: true, avatar: true, profile: true } } } } },
      });
      return res.json({ team: updated });
    }

    // ─── Mode 2: Team info edit ────────────────────────────────
    const safeUpdate: Record<string, unknown> = {};
    if (typeof name === 'string' && name.trim().length >= 3) {
      safeUpdate.name = name.trim();
      // Auto-regenerate shortName if it's not being explicitly set and the new name warrants a different short name
      if (shortName === undefined) {
        const newShort = generateShortName(name.trim());
        // Only update if the current shortName is empty or differs from what the new name would generate
        safeUpdate.shortName = newShort;
      }
    }
    if (typeof shortName === 'string') {
      const trimmed = shortName.trim().slice(0, 4).toUpperCase();
      if (trimmed.length >= 1) safeUpdate.shortName = trimmed;
    }
    if (typeof color === 'string' && /^#[0-9a-f]{3,8}$/i.test(color)) {
      safeUpdate.color = color;
    }
    // logo can be a URL/data-URL string OR null (to clear)
    if (logo !== undefined) {
      safeUpdate.logo = logo;
    }

    if (Object.keys(safeUpdate).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update. Provide name, logo, color, shortName, addMemberId, removeMemberId, or captainId.' });
    }

    const updated = await db.team.update({
      where: { id },
      data: safeUpdate,
      include: { members: { include: { user: { select: { id: true, name: true, avatar: true, profile: true } } } } },
    });

    return res.json({ team: updated });
  } catch (error) {
    console.error('Team update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/teams/:id
 * Captain-only — deletes the team entirely (all members are removed, all
 * tournament entries are orphaned). Requires captainUserId in body.
 */
router.delete('/teams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const captainUserId = (req.body?.captainUserId) || (req.query['captainUserId'] as string) || '';

    if (!captainUserId) {
      return res.status(400).json({ error: 'captainUserId is required' });
    }

    const captainCheck = await isCaptain(id, captainUserId);
    if (!captainCheck) {
      return res.status(403).json({ error: 'Only the team captain can delete the team' });
    }

    await db.team.delete({ where: { id } });
    return res.json({ message: 'Team deleted' });
  } catch (error) {
    console.error('Team delete error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/teams/join', async (req, res) => {
  try {
    const { teamId, userId, teamCode } = req.body;
    if (!userId || (!teamId && !teamCode)) return res.status(400).json({ error: 'userId and (teamId or teamCode) required' });

    let resolvedTeamId = teamId;
    if (!resolvedTeamId && teamCode) {
      const team = await db.team.findFirst({ where: { teamCode } });
      if (!team) return res.status(404).json({ error: 'Team not found with that code' });
      resolvedTeamId = team.id;
    }

    const existing = await db.teamMember.findFirst({ where: { teamId: resolvedTeamId, userId } });
    if (existing) return res.status(409).json({ error: 'Already a member of this team' });

    const member = await db.teamMember.create({ data: { teamId: resolvedTeamId, userId, isCaptain: false } });
    return res.json({ member });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/teams/leave', async (req, res) => {
  try {
    const { teamId, userId } = req.body;
    if (!teamId || !userId) return res.status(400).json({ error: 'teamId and userId required' });

    // If the user is the captain, leaving means either transferring captaincy or deleting the team.
    // For safety: if captain tries to leave without transferring, block them with a helpful message.
    const leavingMember = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!leavingMember) {
      return res.status(404).json({ error: 'You are not a member of this team' });
    }
    if (leavingMember.isCaptain) {
      const otherMembers = await db.teamMember.count({
        where: { teamId, userId: { not: userId } },
      });
      if (otherMembers > 0) {
        return res.status(400).json({
          error: 'You are the captain. Transfer captaincy to another member before leaving, or delete the team instead.',
        });
      }
      // Captain is the only member — leaving = deleting the team
      await db.team.delete({ where: { id: teamId } });
      return res.json({ message: 'Left team', teamDeleted: true });
    }

    await db.teamMember.delete({ where: { id: leavingMember.id } });
    return res.json({ message: 'Left team' });
  } catch (error) {
    console.error('Team leave error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/team-suggestions', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    const teams = await db.team.findMany({ where: { members: { none: { userId: userId || '' } } }, take: 5, include: { _count: { select: { members: true } } } });
    return res.json({ teams: teams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName, color: t.color, teamCode: t.teamCode, memberCount: t._count.members })) });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/teams-leaderboard', async (req, res) => {
  try {
    const limit = parseInt((req.query['limit'] as string) || '20');
    const teams = await db.team.findMany({
      take: limit,
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ teams });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Team Join Requests ─────────────────────────────────────────────

/**
 * POST /api/teams/:id/join-request
 * Body: { userId, message? }
 * Creates a join request for the team. One pending request per user per team.
 */
router.post('/teams/:id/join-request', async (req, res) => {
  try {
    const teamId = req.params['id'];
    const { userId, message } = req.body;
    if (!teamId || !userId) return res.status(400).json({ error: 'teamId and userId are required' });

    // Check team exists
    const team = await db.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Check if already a member
    const existingMember = await db.teamMember.findFirst({ where: { teamId, userId } });
    if (existingMember) return res.status(409).json({ error: 'You are already a member of this team' });

    // Check for existing PENDING request
    const existingRequest = await db.teamJoinRequest.findFirst({
      where: { teamId, userId, status: 'pending' },
    });
    if (existingRequest) return res.status(409).json({ error: 'You already have a pending request for this team' });

    const request = await db.teamJoinRequest.create({
      data: { teamId, userId, message: message || null, status: 'pending' },
      include: { user: { select: { id: true, name: true, avatar: true, playerCode: true } } },
    });

    return res.json({ request });
  } catch (error) {
    console.error('Team join request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/teams/:id/join-requests?userId=...
 * Returns pending join requests for a team. Only team members can view.
 */
router.get('/teams/:id/join-requests', async (req, res) => {
  try {
    const teamId = req.params['id'];
    const userId = (req.query['userId'] as string) || '';
    if (!teamId || !userId) return res.status(400).json({ error: 'teamId and userId are required' });

    // Verify the requester is a member of the team
    const member = await db.teamMember.findFirst({ where: { teamId, userId } });
    if (!member) return res.status(403).json({ error: 'Only team members can view join requests' });

    const requests = await db.teamJoinRequest.findMany({
      where: { teamId, status: 'pending' },
      include: { user: { select: { id: true, name: true, avatar: true, playerCode: true, gender: true, weight: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ requests });
  } catch (error) {
    console.error('Team join requests fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/teams/join-requests/:id/accept
 * Body: { userId }
 * Accepts a join request — adds the requesting user as a team member.
 */
router.post('/teams/join-requests/:id/accept', async (req, res) => {
  try {
    const requestId = req.params['id'];
    const { userId } = req.body;
    if (!requestId || !userId) return res.status(400).json({ error: 'requestId and userId are required' });

    const request = await db.teamJoinRequest.findUnique({
      where: { id: requestId },
      include: { team: { include: { members: true } } },
    });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

    // Verify the accepter is a member of the team
    const isMember = request.team.members.some(m => m.userId === userId);
    if (!isMember) return res.status(403).json({ error: 'Only team members can accept requests' });

    // Add the requesting user as a team member
    await db.teamMember.create({
      data: { teamId: request.teamId, userId: request.userId, isCaptain: false },
    });

    // Mark request as accepted
    await db.teamJoinRequest.update({
      where: { id: requestId },
      data: { status: 'accepted' },
    });

    return res.json({ success: true, message: 'Player added to team' });
  } catch (error) {
    console.error('Accept join request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/teams/join-requests/:id/reject
 * Body: { userId }
 * Rejects a join request.
 */
router.post('/teams/join-requests/:id/reject', async (req, res) => {
  try {
    const requestId = req.params['id'];
    const { userId } = req.body;
    if (!requestId || !userId) return res.status(400).json({ error: 'requestId and userId are required' });

    const request = await db.teamJoinRequest.findUnique({
      where: { id: requestId },
      include: { team: { include: { members: true } } },
    });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

    // Verify the rejecter is a member of the team
    const isMember = request.team.members.some(m => m.userId === userId);
    if (!isMember) return res.status(403).json({ error: 'Only team members can reject requests' });

    await db.teamJoinRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' },
    });

    return res.json({ success: true, message: 'Request rejected' });
  } catch (error) {
    console.error('Reject join request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/teams/my-join-requests?userId=...
 * Returns all join requests SENT by the user (to see their status).
 */
router.get('/teams/my-join-requests', async (req, res) => {
  try {
    const userId = (req.query['userId'] as string) || '';
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const requests = await db.teamJoinRequest.findMany({
      where: { userId },
      include: { team: { select: { id: true, name: true, shortName: true, color: true, logo: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ requests });
  } catch (error) {
    console.error('My join requests error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

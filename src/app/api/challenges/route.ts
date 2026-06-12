import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/challenges - List challenges for a team or user
export async function GET(req: NextRequest) {
  try {
    const teamId = req.nextUrl.searchParams.get('teamId');
    const userId = req.nextUrl.searchParams.get('userId');
    const status = req.nextUrl.searchParams.get('status'); // pending, accepted, etc.

    if (!teamId && !userId) {
      return NextResponse.json({ error: 'teamId or userId required' }, { status: 400 });
    }

    const where: Record<string, unknown> = {};
    if (teamId) {
      where.OR = [
        { fromTeamId: teamId },
        { toTeamId: teamId },
      ];
    }
    if (userId) {
      where.OR = [
        { fromUserId: userId },
        { toUserId: userId },
      ];
    }
    if (status) {
      where.status = status;
    }

    const challenges = await db.challenge.findMany({
      where,
      include: {
        fromTeam: { select: { id: true, name: true, shortName: true, color: true } },
        toTeam: { select: { id: true, name: true, shortName: true, color: true } },
        fromUser: { select: { id: true, name: true, avatar: true } },
        toUser: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Calculate head-to-head record between teams
    let headToHead = null;
    if (teamId) {
      const team = await db.team.findUnique({ where: { id: teamId } });
      if (team) {
        // Find rival teams (teams they've played against most)
        const matches = await db.match.findMany({
          where: {
            status: 'completed',
            OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
          },
          select: {
            homeTeamId: true,
            awayTeamId: true,
            homeScore: true,
            awayScore: true,
          },
        });

        const rivalRecord: Record<string, { wins: number; losses: number; draws: number; name: string }> = {};
        for (const match of matches) {
          const rivalId = match.homeTeamId === teamId ? match.awayTeamId : match.homeTeamId;
          if (!rivalRecord[rivalId]) {
            // Get team name lazily
            rivalRecord[rivalId] = { wins: 0, losses: 0, draws: 0, name: '' };
          }
          const isHome = match.homeTeamId === teamId;
          const ourScore = isHome ? match.homeScore : match.awayScore;
          const theirScore = isHome ? match.awayScore : match.homeScore;
          if (ourScore > theirScore) rivalRecord[rivalId].wins++;
          else if (ourScore < theirScore) rivalRecord[rivalId].losses++;
          else rivalRecord[rivalId].draws++;
        }

        // Get rival team names
        const rivalIds = Object.keys(rivalRecord);
        const rivalTeams = await db.team.findMany({
          where: { id: { in: rivalIds } },
          select: { id: true, name: true },
        });
        for (const rt of rivalTeams) {
          if (rivalRecord[rt.id]) rivalRecord[rt.id].name = rt.name;
        }

        headToHead = Object.entries(rivalRecord)
          .map(([id, rec]) => ({ teamId: id, ...rec }))
          .sort((a, b) => (b.wins + b.losses + b.draws) - (a.wins + a.losses + a.draws))
          .slice(0, 5);
      }
    }

    return NextResponse.json({ challenges, headToHead });
  } catch (error) {
    console.error('Challenges GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 });
  }
}

// POST /api/challenges - Create a new challenge
export async function POST(req: NextRequest) {
  try {
    const { fromTeamId, toTeamId, fromUserId, toUserId, message, expiresAt } = await req.json();

    if (!fromTeamId || !toTeamId || !fromUserId) {
      return NextResponse.json({ error: 'fromTeamId, toTeamId, fromUserId required' }, { status: 400 });
    }

    if (fromTeamId === toTeamId) {
      return NextResponse.json({ error: 'Cannot challenge your own team' }, { status: 400 });
    }

    // Check if there's already a pending challenge between these teams
    const existing = await db.challenge.findFirst({
      where: {
        OR: [
          { fromTeamId, toTeamId, status: 'pending' },
          { fromTeamId: toTeamId, toTeamId: fromTeamId, status: 'pending' },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'A pending challenge already exists between these teams' }, { status: 400 });
    }

    const challenge = await db.challenge.create({
      data: {
        fromTeamId,
        toTeamId,
        fromUserId,
        toUserId: toUserId || null,
        message: message || null,
        status: 'pending',
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
      },
      include: {
        fromTeam: { select: { name: true, color: true } },
        toTeam: { select: { name: true, color: true } },
      },
    });

    // Create notification for the challenged team captain
    if (toUserId) {
      await db.notification.create({
        data: {
          userId: toUserId,
          fromUserId,
          type: 'general',
          title: 'New Challenge!',
          message: `${challenge.fromTeam.name} has challenged ${challenge.toTeam.name}!`,
        },
      });
    }

    return NextResponse.json({ challenge });
  } catch (error) {
    console.error('Challenges POST error:', error);
    return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 });
  }
}

// PATCH /api/challenges - Accept, decline, or complete a challenge
export async function PATCH(req: NextRequest) {
  try {
    const { challengeId, action, matchId } = await req.json();
    if (!challengeId || !action) {
      return NextResponse.json({ error: 'challengeId and action required' }, { status: 400 });
    }

    const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    let status: string;
    switch (action) {
      case 'accept':
        status = 'accepted';
        break;
      case 'decline':
        status = 'declined';
        break;
      case 'complete':
        status = 'completed';
        break;
      case 'expire':
        status = 'expired';
        break;
      default:
        return NextResponse.json({ error: 'Invalid action. Use: accept, decline, complete, expire' }, { status: 400 });
    }

    const updated = await db.challenge.update({
      where: { id: challengeId },
      data: {
        status,
        respondedAt: new Date(),
        matchId: matchId || challenge.matchId,
      },
      include: {
        fromTeam: { select: { name: true, color: true } },
        toTeam: { select: { name: true, color: true } },
      },
    });

    return NextResponse.json({ challenge: updated });
  } catch (error) {
    console.error('Challenges PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update challenge' }, { status: 500 });
  }
}

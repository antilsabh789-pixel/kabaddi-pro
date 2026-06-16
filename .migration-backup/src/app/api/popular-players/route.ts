import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const userId = searchParams.get('userId'); // current user, to check isFollowing

    // Step 1: Count followers per user
    const followerCounts = await db.follow.groupBy({
      by: ['followingId'],
      _count: {
        followingId: true,
      },
      orderBy: {
        _count: {
          followingId: 'desc',
        },
      },
      take: limit * 3, // get more than needed, we'll filter after
    });

    if (followerCounts.length === 0) {
      // If no follows exist, fall back to top players by totalPoints
      const topPlayers = await db.user.findMany({
        where: {
          role: 'player',
          profile: { totalMatches: { gt: 0 } },
        },
        include: {
          profile: true,
        },
        take: limit,
        orderBy: {
          profile: { totalPoints: 'desc' },
        },
      });

      const players = await Promise.all(
        topPlayers.map(async (player, idx) => {
          const teamMemberships = await db.teamMember.findMany({
            where: { userId: player.id },
            include: { team: { select: { name: true, shortName: true } } },
            take: 2,
          });
          const teamNames = teamMemberships.map((tm) => tm.team.name || tm.team.shortName || '').filter(Boolean);

          return {
            rank: idx + 1,
            userId: player.id,
            name: player.name || 'Player',
            avatar: player.avatar || null,
            playerCode: player.playerCode || null,
            gender: player.gender || null,
            position: player.profile?.position || null,
            overallRating: player.profile?.overallRating || 0,
            totalPoints: player.profile?.totalPoints || 0,
            totalMatches: player.profile?.totalMatches || 0,
            raidPoints: player.profile?.raidPoints || 0,
            tacklePoints: player.profile?.tacklePoints || 0,
            followerCount: 0,
            teamNames,
            isFollowing: false,
          };
        })
      );

      return NextResponse.json({ players });
    }

    // Step 2: Get user details for the top followed users
    const followedUserIds = followerCounts.map((fc) => fc.followingId);
    const users = await db.user.findMany({
      where: {
        id: { in: followedUserIds },
      },
      include: {
        profile: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Step 3: Build popularity score = followerCount * 10 + totalPoints
    const playersWithScore = followerCounts
      .map((fc) => {
        const user = userMap.get(fc.followingId);
        if (!user || user.role === 'coach') return null;
        return {
          userId: user.id,
          name: user.name || 'Player',
          avatar: user.avatar || null,
          playerCode: user.playerCode || null,
          gender: user.gender || null,
          position: user.profile?.position || null,
          overallRating: user.profile?.overallRating || 0,
          totalPoints: user.profile?.totalPoints || 0,
          totalMatches: user.profile?.totalMatches || 0,
          raidPoints: user.profile?.raidPoints || 0,
          tacklePoints: user.profile?.tacklePoints || 0,
          followerCount: fc._count.followingId,
          popularityScore: fc._count.followingId * 10 + (user.profile?.totalPoints || 0),
        };
      })
      .filter(Boolean) as Array<{
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
      popularityScore: number;
    }>;

    // Sort by popularity score (composite of followers + points)
    playersWithScore.sort((a, b) => b.popularityScore - a.popularityScore);
    const topPlayers = playersWithScore.slice(0, limit);

    // Step 4: Fetch team names for each player
    const playersWithTeams = await Promise.all(
      topPlayers.map(async (player) => {
        const teamMemberships = await db.teamMember.findMany({
          where: { userId: player.userId },
          include: { team: { select: { name: true, shortName: true } } },
          take: 2,
        });
        const teamNames = teamMemberships.map((tm) => tm.team.name || tm.team.shortName || '').filter(Boolean);
        return { ...player, teamNames };
      })
    );

    // Step 5: Check if current user follows these players
    let followedIds = new Set<string>();
    if (userId) {
      const follows = await db.follow.findMany({
        where: {
          followerId: userId,
          followingId: { in: topPlayers.map((p) => p.userId) },
        },
        select: { followingId: true },
      });
      followedIds = new Set(follows.map((f) => f.followingId));
    }

    // Step 6: Build final response
    const players = playersWithTeams.map((player, idx) => ({
      rank: idx + 1,
      ...player,
      isFollowing: followedIds.has(player.userId),
    }));

    return NextResponse.json({ players });
  } catch (error) {
    console.error('Popular players error:', error);
    return NextResponse.json({ error: 'Failed to fetch popular players' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const ACHIEVEMENT_DEFINITIONS = [
  { key: 'first_raid', name: 'First Blood', description: 'Score your first raid point', icon: '⚔️', category: 'raid', tier: 'bronze', threshold: 1 },
  { key: '10_raids', name: 'Raider Rising', description: 'Complete 10 successful raids', icon: '🗡️', category: 'raid', tier: 'bronze', threshold: 10 },
  { key: '25_raids', name: 'Raid Machine', description: 'Complete 25 successful raids', icon: '⚡', category: 'raid', tier: 'silver', threshold: 25 },
  { key: '50_raids', name: 'Raid King', description: 'Complete 50 successful raids', icon: '👑', category: 'raid', tier: 'gold', threshold: 50 },
  { key: '100_raids', name: 'Raid Legend', description: 'Complete 100 successful raids', icon: '🏆', category: 'raid', tier: 'platinum', threshold: 100 },
  { key: 'super_raid', name: 'Super Raider', description: 'Execute a Super Raid (3+ points in one raid)', icon: '🔥', category: 'raid', tier: 'silver', threshold: 1 },
  { key: 'first_tackle', name: 'First Wall', description: 'Make your first successful tackle', icon: '🛡️', category: 'defense', tier: 'bronze', threshold: 1 },
  { key: '10_tackles', name: 'Iron Defender', description: 'Complete 10 successful tackles', icon: '🧱', category: 'defense', tier: 'bronze', threshold: 10 },
  { key: '25_tackles', name: 'Wall of Steel', description: 'Complete 25 successful tackles', icon: '🏰', category: 'defense', tier: 'silver', threshold: 25 },
  { key: '50_tackles', name: 'Fortress', description: 'Complete 50 successful tackles', icon: '⛰️', category: 'defense', tier: 'gold', threshold: 50 },
  { key: 'super_tackle', name: 'Super Tackler', description: 'Execute a Super Tackle', icon: '💪', category: 'defense', tier: 'silver', threshold: 1 },
  { key: '5_super_tackles', name: 'Tackle Master', description: 'Complete 5 Super Tackles', icon: '🥋', category: 'defense', tier: 'gold', threshold: 5 },
  { key: 'allround_10', name: 'Dual Threat', description: 'Reach 10 raid points AND 10 tackle points', icon: '⭐', category: 'allround', tier: 'bronze', threshold: 10 },
  { key: 'allround_25', name: 'Complete Player', description: 'Reach 25 raid points AND 25 tackle points', icon: '🌟', category: 'allround', tier: 'silver', threshold: 25 },
  { key: 'allround_50', name: 'Kabaddi Maestro', description: 'Reach 50 raid points AND 50 tackle points', icon: '💫', category: 'allround', tier: 'gold', threshold: 50 },
  { key: 'first_follow', name: 'Social Butterfly', description: 'Get your first follower', icon: '🦋', category: 'social', tier: 'bronze', threshold: 1 },
  { key: '10_followers', name: 'Popular Player', description: 'Get 10 followers', icon: '👥', category: 'social', tier: 'silver', threshold: 10 },
  { key: '50_followers', name: 'Kabaddi Star', description: 'Get 50 followers', icon: '⭐', category: 'social', tier: 'gold', threshold: 50 },
  { key: 'first_match', name: 'Debutant', description: 'Play your first match', icon: '🎮', category: 'milestone', tier: 'bronze', threshold: 1 },
  { key: '10_matches', name: 'Regular Player', description: 'Play 10 matches', icon: '📅', category: 'milestone', tier: 'bronze', threshold: 10 },
  { key: '25_matches', name: 'Veteran', description: 'Play 25 matches', icon: '🎖️', category: 'milestone', tier: 'silver', threshold: 25 },
  { key: '50_matches', name: 'Legend', description: 'Play 50 matches', icon: '🏅', category: 'milestone', tier: 'gold', threshold: 50 },
  { key: 'motm_1', name: 'Star Performer', description: 'Win your first Man of the Match', icon: '🌟', category: 'milestone', tier: 'silver', threshold: 1 },
  { key: 'motm_5', name: 'Consistent Star', description: 'Win 5 Man of the Match awards', icon: '💫', category: 'milestone', tier: 'gold', threshold: 5 },
];

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');

    for (const def of ACHIEVEMENT_DEFINITIONS) {
      await db.achievement.upsert({
        where: { key: def.key },
        create: def,
        update: { name: def.name, description: def.description, icon: def.icon, threshold: def.threshold },
      });
    }

    const achievements = await db.achievement.findMany({
      orderBy: [{ category: 'asc' }, { tier: 'asc' }, { threshold: 'asc' }],
      include: {
        userAchievements: userId ? {
          where: { userId },
          select: { unlockedAt: true },
        } : false,
      },
    });

    const formatted = achievements.map((a) => ({
      id: a.id,
      key: a.key,
      name: a.name,
      description: a.description,
      icon: a.icon,
      category: a.category,
      tier: a.tier,
      threshold: a.threshold,
      unlocked: a.userAchievements && a.userAchievements.length > 0,
      unlockedAt: a.userAchievements?.[0]?.unlockedAt || null,
    }));

    let stats = null;
    if (userId) {
      const profile = await db.playerProfile.findUnique({ where: { userId } });
      const matchCount = await db.matchScorer.count({ where: { userId } });
      const followerCount = await db.follow.count({ where: { followingId: userId } });
      const motmCount = await db.match.count({ where: { motmUserId: userId } });
      stats = {
        successfulRaids: profile?.successfulRaids || 0,
        successfulTackles: profile?.successfulTackles || 0,
        superTackles: profile?.superTackles || 0,
        bonusPoints: profile?.bonusPoints || 0,
        matchCount,
        followerCount,
        motmCount,
      };
    }

    return NextResponse.json({ achievements: formatted, stats });
  } catch (error) {
    console.error('Achievements GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const profile = await db.playerProfile.findUnique({ where: { userId } });
    const matchCount = await db.matchScorer.count({ where: { userId } });
    const followerCount = await db.follow.count({ where: { followingId: userId } });
    const motmCount = await db.match.count({ where: { motmUserId: userId } });

    const successfulRaids = profile?.successfulRaids || 0;
    const successfulTackles = profile?.successfulTackles || 0;
    const superTacklesCount = profile?.superTackles || 0;
    const raidPoints = successfulRaids + (profile?.bonusPoints || 0);
    const tacklePoints = successfulTackles;

    for (const def of ACHIEVEMENT_DEFINITIONS) {
      await db.achievement.upsert({
        where: { key: def.key },
        create: def,
        update: {},
      });
    }

    const shouldUnlock: Record<string, boolean> = {
      'first_raid': successfulRaids >= 1,
      '10_raids': successfulRaids >= 10,
      '25_raids': successfulRaids >= 25,
      '50_raids': successfulRaids >= 50,
      '100_raids': successfulRaids >= 100,
      'super_raid': raidPoints >= 3,
      'first_tackle': successfulTackles >= 1,
      '10_tackles': successfulTackles >= 10,
      '25_tackles': successfulTackles >= 25,
      '50_tackles': successfulTackles >= 50,
      'super_tackle': superTacklesCount >= 1,
      '5_super_tackles': superTacklesCount >= 5,
      'allround_10': raidPoints >= 10 && tacklePoints >= 10,
      'allround_25': raidPoints >= 25 && tacklePoints >= 25,
      'allround_50': raidPoints >= 50 && tacklePoints >= 50,
      'first_follow': followerCount >= 1,
      '10_followers': followerCount >= 10,
      '50_followers': followerCount >= 50,
      'first_match': matchCount >= 1,
      '10_matches': matchCount >= 10,
      '25_matches': matchCount >= 25,
      '50_matches': matchCount >= 50,
      'motm_1': motmCount >= 1,
      'motm_5': motmCount >= 5,
    };

    const newlyUnlocked: string[] = [];

    for (const [key, should] of Object.entries(shouldUnlock)) {
      if (!should) continue;
      const achievement = await db.achievement.findUnique({ where: { key } });
      if (!achievement) continue;

      const existing = await db.userAchievement.findUnique({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
      });

      if (!existing) {
        await db.userAchievement.create({
          data: { userId, achievementId: achievement.id },
        });
        newlyUnlocked.push(achievement.name);
      }
    }

    return NextResponse.json({
      newlyUnlocked,
      totalUnlocked: Object.values(shouldUnlock).filter(Boolean).length,
    });
  } catch (error) {
    console.error('Achievements POST error:', error);
    return NextResponse.json({ error: 'Failed to check achievements' }, { status: 500 });
  }
}

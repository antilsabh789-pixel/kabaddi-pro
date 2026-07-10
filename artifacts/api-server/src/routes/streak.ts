import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

/**
 * Daily Check-in Streak System
 *
 * Reward milestones (claimed once per milestone, in order):
 *   15 days  → 1 day free premium
 *   25 days  → special "25 Days Warrior" badge
 *   50 days  → shaker water bottle (physical prize)
 *   100 days → kabaddi kit with player's name (physical prize)
 *   150 days → 1kg protein powder (physical prize)
 *   200 days → 1kg protein powder (physical prize)
 *   250 days → 1kg protein powder (physical prize)
 *   then every 50 days (300, 350, 400, ...) → 1kg protein powder (physical prize)
 *
 * Streak rules:
 *   - Check in once per day (midnight UTC boundary)
 *   - If you check in 2 days in a row, streak increments
 *   - If you miss a day, streak resets to 0
 *   - Checking in on the same day you already checked in is a no-op (200, streak unchanged)
 */

interface MilestoneReward {
  day: number;
  type: 'premium' | 'badge' | 'physical';
  title: string;
  description: string;
  icon: string;
  premiumDays?: number; // for type === 'premium'
}

const MILESTONE_REWARDS: MilestoneReward[] = [
  { day: 15, type: 'premium', title: '1 Day Free Premium', description: 'Enjoy 24 hours of Premium access — unlock advanced stats, AI insights, and more.', icon: 'crown', premiumDays: 1 },
  { day: 25, type: 'badge', title: '25 Days Warrior Badge', description: 'A special badge on your profile showing you completed 25 continuous days.', icon: 'medal' },
  { day: 50, type: 'physical', title: 'Shaker Water Bottle', description: 'Claim a Kabaddi Pro branded shaker water bottle. Free shipping.', icon: 'bottle' },
  { day: 100, type: 'physical', title: 'Kabaddi Kit (Your Name)', description: 'A full kabaddi kit personalized with your name on it.', icon: 'kit' },
  { day: 150, type: 'physical', title: '1kg Protein Powder', description: '1kg of premium protein powder to fuel your training.', icon: 'protein' },
  { day: 200, type: 'physical', title: '1kg Protein Powder', description: 'Another 1kg of premium protein powder. Keep going!', icon: 'protein' },
  { day: 250, type: 'physical', title: '1kg Protein Powder', description: 'Another 1kg of premium protein powder. Legendary!', icon: 'protein' },
  // 300, 350, 400, ... are generated dynamically below
];

/**
 * Get the reward for a given milestone day, including the dynamic "every 50 days
 * after 250" rule.
 */
function getRewardForDay(day: number): MilestoneReward | null {
  // Check the fixed milestones first
  const fixed = MILESTONE_REWARDS.find((m) => m.day === day);
  if (fixed) return fixed;

  // Dynamic milestone: every 50 days after 250 (300, 350, 400, ...)
  if (day > 250 && day % 50 === 0) {
    return {
      day,
      type: 'physical',
      title: '1kg Protein Powder',
      description: 'Another 1kg of premium protein powder. You are a legend!',
      icon: 'protein',
    };
  }
  return null;
}

/**
 * Get all milestone rewards (fixed + dynamic up to some reasonable max),
 * used to render the reward roadmap in the UI.
 */
function getAllMilestones(): MilestoneReward[] {
  const all = [...MILESTONE_REWARDS];
  // Generate dynamic milestones up to 1000 days
  for (let day = 300; day <= 1000; day += 50) {
    all.push({
      day,
      type: 'physical',
      title: '1kg Protein Powder',
      description: 'Another 1kg of premium protein powder. You are a legend!',
      icon: 'protein',
    });
  }
  return all;
}

/**
 * Returns the number of days between two dates (ignoring time of day).
 * Same day = 0, yesterday = 1, etc.
 */
function daysBetween(a: Date, b: Date): number {
  const aDay = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bDay = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((aDay.getTime() - bDay.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Returns true if the user has already checked in today.
 */
function isCheckedInToday(lastCheckIn: Date | null): boolean {
  if (!lastCheckIn) return false;
  return daysBetween(new Date(), lastCheckIn) === 0;
}

/**
 * GET /api/streak?userId=...
 * Returns the user's streak info + all milestone rewards + claim status.
 */
router.get('/streak', async (req, res) => {
  try {
    const userId = (req.query['userId'] as string) || '';
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const streak = await db.userStreak.findUnique({ where: { userId } });
    const currentStreak = streak?.currentStreak || 0;
    const longestStreak = streak?.longestStreak || 0;
    const totalCheckIns = streak?.totalCheckIns || 0;
    const lastCheckIn = streak?.lastCheckIn || null;

    let claimedMilestones: number[] = [];
    try {
      claimedMilestones = JSON.parse(streak?.claimedMilestones || '[]');
    } catch { claimedMilestones = []; }

    // Auto-fix: if the streak is broken (last check-in was more than 1 day ago),
    // reset it to 0. This runs lazily on every GET so the UI is always accurate.
    // IMPORTANT: This MUST run BEFORE building the milestones roadmap so the
    // isClaimable / isLocked flags reflect the post-reset streak (otherwise a
    // user with a broken 30-day streak would see all milestones claimable but
    // be rejected by /streak/claim when their currentStreak is actually 0).
    let effectiveStreak = currentStreak;
    if (lastCheckIn) {
      const daysSince = daysBetween(new Date(), lastCheckIn);
      if (daysSince > 1 && currentStreak > 0) {
        effectiveStreak = 0;
        if (streak) {
          await db.userStreak.update({
            where: { userId },
            data: { currentStreak: 0 },
          });
        }
      }
    }

    // Build the reward roadmap with claim status — uses effectiveStreak so a
    // broken streak correctly shows future milestones as locked.
    const milestones = getAllMilestones().map((m) => ({
      ...m,
      isClaimed: claimedMilestones.includes(m.day),
      isClaimable: effectiveStreak >= m.day && !claimedMilestones.includes(m.day),
      isLocked: effectiveStreak < m.day,
    }));

    return res.json({
      currentStreak: effectiveStreak,
      longestStreak,
      totalCheckIns,
      lastCheckIn,
      isCheckedInToday: isCheckedInToday(lastCheckIn),
      milestones,
      // The next milestone the user is working toward
      nextMilestone: milestones.find((m) => m.day > effectiveStreak) || null,
    });
  } catch (error) {
    console.error('GET /streak error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/streak/check-in
 * Body: { userId }
 * Records a daily check-in. Streak rules:
 *   - Same-day check-in → no-op, returns current streak
 *   - Yesterday's streak + 1 today → streak increments
 *   - Gap > 1 day → streak resets to 1 (today is day 1 of a new streak)
 * Auto-claims any newly-reached milestone? No — user must claim manually via
 * POST /api/streak/claim so they get a celebration moment.
 */
router.post('/streak/check-in', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let streak = await db.userStreak.findUnique({ where: { userId } });
    if (!streak) {
      // First-ever check-in: create the record
      streak = await db.userStreak.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          totalCheckIns: 1,
          lastCheckIn: new Date(),
          claimedMilestones: '[]',
        },
      });
    } else {
      // Race-safe same-day check-in guard: do a conditional update that only
      // succeeds if lastCheckIn is from a PREVIOUS day. If two concurrent
      // requests arrive at the same moment, only one of them will see
      // result.count === 1 — the other gets count:0 and is treated as a
      // no-op. This prevents inflating totalCheckIns from a double-tap.
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const updated = await db.userStreak.updateMany({
        where: {
          userId,
          OR: [
            { lastCheckIn: null },
            { lastCheckIn: { lt: startOfToday } },
          ],
        },
        data: (() => {
          // Compute the new streak based on the existing streak + lastCheckIn.
          // We have to do this in JS because Prisma can't compute "yesterday"
          // in SQL. The conditional update above guarantees only one writer
          // wins, so the JS read we did earlier (streak.currentStreak /
          // streak.lastCheckIn) is still valid for the winning writer.
          let newStreak = 1;
          if (streak.lastCheckIn) {
            const daysSince = daysBetween(now, streak.lastCheckIn);
            if (daysSince === 1) newStreak = streak.currentStreak + 1;
          }
          return {
            currentStreak: newStreak,
            longestStreak: Math.max(streak.longestStreak, newStreak),
            totalCheckIns: streak.totalCheckIns + 1,
            lastCheckIn: now,
          };
        })(),
      });

      if (updated.count === 0) {
        // Either already checked in today, or another concurrent request won.
        // Either way, return the current state as a no-op.
        const fresh = await db.userStreak.findUnique({ where: { userId } });
        return res.json({
          success: true,
          alreadyCheckedIn: true,
          currentStreak: fresh?.currentStreak || 0,
          longestStreak: fresh?.longestStreak || 0,
          totalCheckIns: fresh?.totalCheckIns || 0,
          lastCheckIn: fresh?.lastCheckIn || null,
        });
      }

      // Re-fetch the updated streak so we have the freshest values
      streak = (await db.userStreak.findUnique({ where: { userId } }))!;
    }

    return res.json({
      success: true,
      alreadyCheckedIn: false,
      currentStreak: streak!.currentStreak,
      longestStreak: streak!.longestStreak,
      totalCheckIns: streak!.totalCheckIns,
      lastCheckIn: streak!.lastCheckIn,
    });
  } catch (error) {
    console.error('POST /streak/check-in error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/streak/claim
 * Body: { userId, day }
 * Claims a milestone reward. Rules:
 *   - User's current streak must be >= the milestone day
 *   - Must not have already claimed this milestone
 *   - For 'premium' rewards: grants the premium days immediately
 *   - For 'badge' / 'physical' rewards: just records the claim (physical prizes
 *     are fulfilled manually by the admin; badges are displayed on profile)
 */
router.post('/streak/claim', async (req, res) => {
  try {
    const { userId, day } = req.body;
    if (!userId || !day) return res.status(400).json({ error: 'userId and day are required' });

    const milestoneDay = parseInt(day, 10);
    if (isNaN(milestoneDay)) return res.status(400).json({ error: 'day must be a number' });

    const reward = getRewardForDay(milestoneDay);
    if (!reward) return res.status(400).json({ error: 'No reward at this milestone' });

    const streak = await db.userStreak.findUnique({ where: { userId } });
    if (!streak) return res.status(404).json({ error: 'No streak found. Check in first.' });

    if (streak.currentStreak < milestoneDay) {
      return res.status(403).json({
        error: `You need a ${milestoneDay}-day streak to claim this reward. You're at ${streak.currentStreak} days.`,
      });
    }

    let claimedMilestones: number[] = [];
    try {
      claimedMilestones = JSON.parse(streak.claimedMilestones || '[]');
    } catch { claimedMilestones = []; }

    if (claimedMilestones.includes(milestoneDay)) {
      return res.status(409).json({ error: 'You already claimed this reward' });
    }

    // Grant premium if applicable
    let premiumGranted = false;
    if (reward.type === 'premium' && reward.premiumDays) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { isPremium: true, premiumExpiry: true, premiumPlan: true },
      });
      if (user) {
        const now = new Date();
        const dayMs = 24 * 60 * 60 * 1000;
        const existingExpiry = user.premiumExpiry ? new Date(user.premiumExpiry) : null;
        const base = (user.isPremium && existingExpiry && existingExpiry > now) ? existingExpiry : now;
        const newExpiry = new Date(base.getTime() + reward.premiumDays * dayMs);
        await db.user.update({
          where: { id: userId },
          data: {
            isPremium: true,
            premiumExpiry: newExpiry,
            premiumPlan: user.premiumPlan && user.premiumPlan !== 'referral' ? user.premiumPlan : 'streak',
          },
        });
        premiumGranted = true;
      }
    }

    // Mark as claimed
    claimedMilestones.push(milestoneDay);
    await db.userStreak.update({
      where: { userId },
      data: { claimedMilestones: JSON.stringify(claimedMilestones) },
    });

    return res.json({
      success: true,
      reward,
      premiumGranted,
      message: reward.type === 'physical'
        ? 'Reward claimed! Our team will contact you to arrange delivery.'
        : reward.type === 'badge'
        ? 'Badge unlocked! It will appear on your profile.'
        : `${reward.premiumDays} day(s) of Premium activated!`,
    });
  } catch (error) {
    console.error('POST /streak/claim error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
